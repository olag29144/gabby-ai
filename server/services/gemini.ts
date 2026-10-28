import { keyManager } from './keyManager.js';
import type { KeyEntry, Provider } from './keyManager.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface ApiAttachment {
  name: string;
  mimeType: string;
  dataUrl?: string;
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ApiAttachment[];
}

// ─── Model routing ─────────────────────────────────────────────────────────────

/**
 * Map a model ID to the best provider.
 * Groq-native models start with "groq/" or are known Groq model IDs.
 * Gemini-direct models start with "gemini-" (no slash prefix).
 * Everything else goes to OpenRouter.
 */
function resolveProvider(modelId: string): Provider {
  // Explicit groq/ prefix
  if (modelId.startsWith('groq/')) return 'groq';
  if (GROQ_NATIVE_MODELS.has(modelId)) return 'groq';
  // Raw gemini model IDs (no slash, e.g. "gemini-1.5-flash")
  if (!modelId.includes('/') || modelId.startsWith('gemini-')) return 'gemini';
  return 'openrouter';
}

const GROQ_NATIVE_MODELS = new Set([
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'allam-2-7b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  // Legacy models (may be on other key tiers)
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
]);

// Strip routing prefixes to get the raw model ID for the provider
function rawModelId(modelId: string, provider: Provider): string {
  if (provider === 'groq') return modelId.replace(/^groq\//, ''); // strip our "groq/" prefix
  if (provider === 'gemini') return modelId.replace(/^google\//, '').replace(/:free$/, '');
  return modelId; // OpenRouter uses full IDs like "google/gemini-2.0-flash-exp:free"
}

// ─── Content builders ──────────────────────────────────────────────────────────

type OAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function toOAIMessage(msg: ApiMessage): { role: string; content: string | OAIContentPart[] } {
  const imageParts: OAIContentPart[] = (msg.attachments ?? [])
    .filter(a => a.dataUrl && a.mimeType.startsWith('image/'))
    .map(a => ({ type: 'image_url' as const, image_url: { url: a.dataUrl! } }));

  if (imageParts.length === 0) return { role: msg.role, content: msg.content };

  const parts: OAIContentPart[] = [...imageParts];
  if (msg.content) parts.push({ type: 'text', text: msg.content });
  return { role: msg.role, content: parts };
}

// ─── OpenAI-compatible SSE stream (shared by OpenRouter + Groq) ───────────────

async function* streamOAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  extraHeaders: Record<string, string> = {},
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(toOAIMessage),
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await extractError(response);
    throw Object.assign(new Error(err.message), { status: response.status });
  }

  yield* readSSE(response);
}

// ─── Gemini direct ─────────────────────────────────────────────────────────────

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }

function toGeminiContent(msg: ApiMessage): GeminiContent {
  const parts: GeminiPart[] = [];
  for (const att of msg.attachments ?? []) {
    if (att.dataUrl && att.mimeType) {
      const data = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
      parts.push({ inlineData: { mimeType: att.mimeType, data: data ?? '' } });
    }
  }
  if (msg.content) parts.push({ text: msg.content });
  if (parts.length === 0) parts.push({ text: '' });
  return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
}

async function* streamGemini(
  messages: ApiMessage[],
  model: string,
  apiKey: string,
): AsyncGenerator<string> {
  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: messages.map(toGeminiContent) }),
    },
  );

  if (!response.ok) {
    const err = await extractError(response);
    throw Object.assign(new Error(err.message), { status: response.status });
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream.');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Shared SSE reader for OpenAI-compatible responses ────────────────────────

async function* readSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream.');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            error?: { message?: string };
          };
          if (parsed.error?.message) throw new Error(parsed.error.message);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) yield text;
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'SyntaxError') throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function extractError(res: Response): Promise<{ message: string }> {
  try {
    const body = await res.json() as { error?: { message?: string }; message?: string };
    return { message: body?.error?.message ?? body?.message ?? `HTTP ${res.status}` };
  } catch {
    return { message: `HTTP ${res.status}` };
  }
}

// ─── Attempt one key ───────────────────────────────────────────────────────────

async function* tryKey(
  entry: KeyEntry,
  messages: ApiMessage[],
  modelId: string,
): AsyncGenerator<string> {
  const model = rawModelId(modelId, entry.provider);

  switch (entry.provider) {
    case 'openrouter':
      yield* streamOAI(OPENROUTER_BASE, entry.key, modelId, messages, {
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Nova AI',
      });
      break;
    case 'groq':
      yield* streamOAI(GROQ_BASE, entry.key, model, messages);
      break;
    case 'gemini':
      yield* streamGemini(messages, model, entry.key);
      break;
  }
}

// ─── Friendly errors ───────────────────────────────────────────────────────────

function humanize(err: unknown, provider: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  if (status === 401 || msg.includes('API key') || msg.includes('INVALID_ARGUMENT')) {
    return `Invalid ${provider} API key. Check your .env file.`;
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Rate limit reached. Nova AI will try the next available key.';
  }
  if (status === 402) return 'API credits exhausted. Add credits at openrouter.ai.';
  if (status === 404 || msg.includes('NOT_FOUND') || msg.includes('not found')) {
    return 'Model not found. Please select a different model.';
  }
  if (status === 503 || msg.includes('overloaded')) {
    return 'AI provider is overloaded. Trying next key…';
  }
  return msg;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function* streamChat(
  messages: ApiMessage[],
  modelId?: string,
): AsyncGenerator<string, void, unknown> {
  const model = modelId ?? process.env.DEFAULT_MODEL ?? 'google/gemini-2.0-flash-exp:free';
  const preferredProvider = resolveProvider(model);
  const orderedKeys = keyManager.getOrderedKeys(preferredProvider);

  if (orderedKeys.length === 0) {
    throw new Error(
      'No API keys configured. Add OPENROUTER_API_KEYS or GROQ_API_KEYS to your .env file.'
    );
  }

  let lastError: unknown;

  for (const keyEntry of orderedKeys) {
    const isRetry = keyEntry !== orderedKeys[0];
    if (isRetry) {
      console.log(`[AI] Retrying with ${keyEntry.provider} key ${keyEntry.key.slice(0, 10)}…`);
    }

    try {
      keyEntry.totalRequests++;
      for await (const chunk of tryKey(keyEntry, messages, model)) {
        yield chunk;
      }
      keyManager.markSuccess(keyEntry);
      return;
    } catch (err: unknown) {
      lastError = err;
      keyManager.markFailure(keyEntry);

      const status = (err as { status?: number }).status;
      // Auth errors are permanent — skip remaining keys of the same provider
      const isAuthError = status === 401 || status === 403;
      if (isAuthError) {
        console.warn(`[AI] Auth error on ${keyEntry.provider}, skipping remaining ${keyEntry.provider} keys.`);
        // Remove remaining keys of this provider from consideration
        const remainingForProvider = orderedKeys.filter(
          k => k !== keyEntry && k.provider === keyEntry.provider && !orderedKeys.indexOf(k)
        );
        remainingForProvider.forEach(k => keyManager.markFailure(k));
      }
    }
  }

  throw new Error(humanize(lastError, preferredProvider));
}
