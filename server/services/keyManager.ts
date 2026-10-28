export type Provider = 'openrouter' | 'gemini' | 'groq';

export interface KeyEntry {
  key: string;
  provider: Provider;
  failures: number;
  lastFailedAt: number;
  totalRequests: number;
  totalFailures: number;
}

const COOLDOWN_MS = 60_000;
const MAX_FAILURES = 2;

class KeyManager {
  private keys: KeyEntry[] = [];
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;
    this.reload();
  }

  reload() {
    this.keys = [];

    for (const key of parseKeys(process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY ?? '')) {
      this.keys.push(makeEntry(key, 'openrouter'));
    }
    for (const key of parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? '')) {
      this.keys.push(makeEntry(key, 'groq'));
    }
    for (const key of parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? '')) {
      // Only accept real Gemini keys (AIza...)
      if (key.startsWith('AIza')) {
        this.keys.push(makeEntry(key, 'gemini'));
      } else if (key.length > 0) {
        console.warn(`[KeyManager] Skipped invalid Gemini key (must start with AIza): ${maskKey(key)}`);
      }
    }

    if (this.keys.length === 0) {
      console.warn('[KeyManager] No API keys configured.');
    } else {
      const summary = this.keys.map(k => `${k.provider}(${maskKey(k.key)})`).join(', ');
      console.log(`[KeyManager] ${this.keys.length} key(s) loaded: ${summary}`);
    }
  }

  getKeysForProvider(provider: Provider): KeyEntry[] {
    this.init();
    const now = Date.now();
    return this.keys
      .filter(k => k.provider === provider)
      .sort((a, b) => {
        const aOk = !(a.failures >= MAX_FAILURES && now - a.lastFailedAt < COOLDOWN_MS);
        const bOk = !(b.failures >= MAX_FAILURES && now - b.lastFailedAt < COOLDOWN_MS);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return a.totalFailures - b.totalFailures;
      });
  }

  getOrderedKeys(preferredProvider: Provider): KeyEntry[] {
    this.init();
    const order: Provider[] = [preferredProvider];
    for (const p of ['openrouter', 'groq', 'gemini'] as Provider[]) {
      if (!order.includes(p)) order.push(p);
    }
    return order.flatMap(p => this.getKeysForProvider(p));
  }

  markSuccess(entry: KeyEntry) {
    entry.failures = 0;
  }

  markFailure(entry: KeyEntry) {
    entry.failures++;
    entry.lastFailedAt = Date.now();
    entry.totalFailures++;
    console.warn(
      `[KeyManager] ${entry.provider} key ${maskKey(entry.key)} failed ` +
      `(${entry.failures}x)${entry.failures >= MAX_FAILURES ? ' — cooling down' : ''}`
    );
  }

  getStatus() {
    this.init();
    const now = Date.now();
    return this.keys.map(k => ({
      provider: k.provider,
      key: maskKey(k.key),
      healthy: !(k.failures >= MAX_FAILURES && now - k.lastFailedAt < COOLDOWN_MS),
      totalRequests: k.totalRequests,
      totalFailures: k.totalFailures,
    }));
  }

  get count() {
    this.init();
    return this.keys.length;
  }

  hasProvider(provider: Provider): boolean {
    this.init();
    return this.keys.some(k => k.provider === provider);
  }
}

function makeEntry(key: string, provider: Provider): KeyEntry {
  return { key, provider, failures: 0, lastFailedAt: 0, totalRequests: 0, totalFailures: 0 };
}

function parseKeys(raw: string): string[] {
  return raw.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export const keyManager = new KeyManager();
