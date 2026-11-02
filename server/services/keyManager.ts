import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

export type Provider = 'openrouter' | 'gemini' | 'groq';

export interface KeyEntry {
  key: string;
  provider: Provider;
  failures: number;
  lastFailedAt: number;
  totalRequests: number;
  totalFailures: number;
  authFailed?: boolean;
}

const COOLDOWN_MS = 15_000;
const MAX_FAILURES = 3;

export function isPlaceholderKey(k: string): boolean {
  if (!k || typeof k !== 'string') return true;
  const trimmed = k.trim();
  if (trimmed.length < 15) return true;
  const lower = trimmed.toLowerCase();

  // Common template / dummy placeholders
  if (
    lower.includes('yourkey') ||
    lower.includes('your_') ||
    lower.includes('keyhere') ||
    lower.includes('key_here') ||
    lower.includes('my_gemini') ||
    lower.includes('placeholder') ||
    lower.includes('change_me') ||
    lower.includes('example') ||
    lower.includes('insert_') ||
    lower === 'sk-or-v1-key1here' ||
    lower === 'sk-or-v1-key2here' ||
    lower === 'gsk_yourkeyhere' ||
    lower === 'aizasyyourkeyhere' ||
    lower === 'my_gemini_api_key'
  ) {
    return true;
  }

  return false;
}

class KeyManager {
  private keys: KeyEntry[] = [];
  private initialized = false;
  private lastEnvMtime = 0;

  private init() {
    if (this.initialized) {
      this.checkEnvUpdated();
      return;
    }
    this.initialized = true;
    this.reload();
  }

  private checkEnvUpdated() {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const stat = fs.statSync(envPath);
        if (stat.mtimeMs !== this.lastEnvMtime) {
          this.reload();
        }
      }
    } catch {
      // ignore
    }
  }

  reload() {
    const envPath = path.resolve(process.cwd(), '.env');
    try {
      if (fs.existsSync(envPath)) {
        const stat = fs.statSync(envPath);
        this.lastEnvMtime = stat.mtimeMs;
        dotenv.config({ path: envPath, override: true });
      } else {
        dotenv.config({ override: true });
      }
    } catch {
      // ignore
    }

    this.keys = [];

    // OpenRouter keys
    const openrouterRaw =
      process.env.OPENROUTER_API_KEYS ??
      process.env.OPENROUTER_API_KEY ??
      process.env.OPENROUTER_KEY ??
      '';
    for (const key of parseKeys(openrouterRaw)) {
      this.keys.push(makeEntry(key, 'openrouter'));
    }

    // Groq keys
    const groqRaw =
      process.env.GROQ_API_KEYS ??
      process.env.GROQ_API_KEY ??
      process.env.GROQ_KEY ??
      '';
    for (const key of parseKeys(groqRaw)) {
      this.keys.push(makeEntry(key, 'groq'));
    }

    // Gemini keys
    const geminiRaw =
      process.env.GEMINI_API_KEYS ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      process.env.VITE_GEMINI_API_KEY ??
      process.env.GEMINI_KEY ??
      '';
    for (const key of parseKeys(geminiRaw)) {
      this.keys.push(makeEntry(key, 'gemini'));
    }

    if (this.keys.length === 0) {
      console.warn('[KeyManager] No active API keys found (placeholders filtered out). Set GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in .env');
    } else {
      const summary = this.keys.map(k => `${k.provider}(${maskKey(k.key)})`).join(', ');
      console.log(`[KeyManager] ${this.keys.length} active key(s) loaded: ${summary}`);
    }
  }

  getKeysForProvider(provider: Provider): KeyEntry[] {
    this.init();

    const now = Date.now();
    return this.keys
      .filter(k => k.provider === provider && !k.authFailed)
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
    for (const p of ['gemini', 'groq', 'openrouter'] as Provider[]) {
      if (!order.includes(p)) order.push(p);
    }
    return order.flatMap(p => this.getKeysForProvider(p));
  }

  markSuccess(entry: KeyEntry) {
    entry.failures = 0;
    entry.authFailed = false;
  }

  markFailure(entry: KeyEntry, isAuthError = false) {
    entry.failures++;
    entry.lastFailedAt = Date.now();
    entry.totalFailures++;
    if (isAuthError) {
      entry.authFailed = true;
    }
    console.warn(
      `[KeyManager] ${entry.provider} key ${maskKey(entry.key)} failed ` +
      `(${entry.failures}x)${isAuthError ? ' — marked invalid' : entry.failures >= MAX_FAILURES ? ' — cooling down' : ''}`
    );
  }

  getStatus() {
    this.init();
    const now = Date.now();
    return this.keys.map(k => ({
      provider: k.provider,
      key: maskKey(k.key),
      healthy: !k.authFailed && !(k.failures >= MAX_FAILURES && now - k.lastFailedAt < COOLDOWN_MS),
      totalRequests: k.totalRequests,
      totalFailures: k.totalFailures,
    }));
  }

  get count() {
    this.init();
    return this.keys.filter(k => !k.authFailed).length;
  }

  hasProvider(provider: Provider): boolean {
    this.init();
    return this.keys.some(k => k.provider === provider && !k.authFailed);
  }
}

function makeEntry(key: string, provider: Provider): KeyEntry {
  return { key, provider, failures: 0, lastFailedAt: 0, totalRequests: 0, totalFailures: 0, authFailed: false };
}

function parseKeys(raw: string): string[] {
  return raw
    .split(',')
    .map(k => {
      let cleaned = k.trim();
      cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
      cleaned = cleaned.replace(/^Bearer\s+/i, '').trim();
      return cleaned;
    })
    .filter(k => k.length > 0 && !isPlaceholderKey(k));
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export const keyManager = new KeyManager();

