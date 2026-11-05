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
 * Gemini-direct models start with "gemini-" or "google/".
 * Everything else goes to OpenRouter.
 */
function resolveProvider(modelId: string): Provider {
  if (modelId.startsWith('groq/')) return 'groq';
  if (GROQ_NATIVE_MODELS.has(modelId)) return 'groq';
  if (modelId.startsWith('gemini-') || modelId.startsWith('google/') || !modelId.includes('/')) {
    return 'gemini';
  }
  return 'openrouter';
}

const GROQ_NATIVE_MODELS = new Set([
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'allam-2-7b',
  'whisper-large-v3',
  'whisper-large-v3-turbo',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
]);

// Strip routing prefixes to get the raw model ID for the provider
function rawModelId(modelId: string, provider: Provider): string {
  if (provider === 'groq') {
    if (modelId.startsWith('gemini') || modelId.startsWith('google/') || modelId.startsWith('anthropic/')) {
      return 'llama-3.3-70b-versatile';
    }
    return modelId.replace(/^groq\//, '');
  }
  if (provider === 'gemini') {
    if (modelId.startsWith('groq/') || (!modelId.startsWith('gemini') && !modelId.startsWith('google/'))) {
      return 'gemini-2.0-flash';
    }
    return modelId.replace(/^google\//, '').replace(/:free$/, '');
  }
  if (provider === 'openrouter') {
    if (modelId.startsWith('groq/')) {
      return 'google/gemini-2.0-flash-exp:free';
    }
    return modelId;
  }
  return modelId;
}

// ─── Content builders ──────────────────────────────────────────────────────────

type OAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function toOAIMessage(msg: ApiMessage): { role: string; content: string | OAIContentPart[] } {
  const imageParts: OAIContentPart[] = (msg.attachments ?? [])
    .filter(a => a.dataUrl && a.mimeType.startsWith('image/'))
    .map(a => ({ type: 'image_url' as const, image_url: { url: a.dataUrl! } }));

  if (imageParts.length === 0) return { role: msg.role, content: msg.content || '' };

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

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Sanitizes messages into compliant Gemini contents:
 * 1. Strict alternating roles ('user' -> 'model' -> 'user' -> 'model')
 * 2. Leading message must be 'user'
 * 3. No empty parts ('Text part cannot be empty' error prevention)
 * 4. Merges consecutive messages of the same role
 */
function sanitizeGeminiContents(messages: ApiMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];

    for (const att of msg.attachments ?? []) {
      if (att.dataUrl && att.mimeType) {
        const rawBase64 = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
        if (rawBase64 && rawBase64.trim().length > 0) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: rawBase64.trim(),
            },
          });
        }
      }
    }

    const text = (msg.content ?? '').trim();
    if (text.length > 0) {
      parts.push({ text });
    }

    // Skip empty messages with neither text nor media
    if (parts.length === 0) continue;

    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      // Merge with previous turn to preserve strict role alternation
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  // Ensure first message is from 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  // Fallback if empty
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  return contents;
}

async function* streamGemini(
  messages: ApiMessage[],
  model: string,
  apiKey: string,
): AsyncGenerator<string> {
  const cleanModel = model.replace(/^models\//, '').replace(/^gemini\//, '');
  const url = `${GEMINI_BASE}/models/${cleanModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const contents = sanitizeGeminiContents(messages);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

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
            error?: { message?: string; status?: string };
          };
          if (parsed.error?.message) {
            throw new Error(parsed.error.message);
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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
    const body = (await res.json()) as {
      error?: {
        message?: string;
        status?: string;
        details?: Array<{ reason?: string; message?: string }>;
      };
      message?: string;
    };

    if (body?.error?.message) {
      return { message: body.error.message };
    }
    return { message: body?.message ?? `HTTP ${res.status}` };
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
      yield* streamOAI(OPENROUTER_BASE, entry.key, model, messages, {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Gabby AI',
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
  const lowerMsg = msg.toLowerCase();

  const isInvalidKey =
    status === 401 ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('invalid api key') ||
    (status === 403 && (lowerMsg.includes('key') || lowerMsg.includes('credential')));

  if (isInvalidKey) {
    if (provider === 'groq') {
      return 'Groq API key was rejected (401 Unauthorized). Please check that your key is active at https://console.groq.com/keys and set as GROQ_API_KEY in your .env file.';
    }
    if (provider === 'gemini') {
      return 'Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in your .env file.';
    }
    return `Invalid ${provider} API key. Please verify that your API key is active and correctly set in your .env file.`;
  }
  if (status === 429 || lowerMsg.includes('rate limit') || lowerMsg.includes('resource_exhausted')) {
    return 'Rate limit reached or quota exceeded. Please wait a moment or check your API billing quota.';
  }
  if (status === 402) {
    return 'API credits exhausted. Please top up credits or use a free tier model.';
  }
  if (status === 404 || lowerMsg.includes('not_found') || lowerMsg.includes('not found')) {
    return `Model "${provider}" was not found or is unavailable. Please select another model from the menu.`;
  }
  if (status === 503 || lowerMsg.includes('overloaded') || lowerMsg.includes('unavailable')) {
    return 'The AI service is temporarily overloaded. Please try again shortly.';
  }

  return msg;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function* streamChat(
  messages: ApiMessage[],
  modelId?: string,
): AsyncGenerator<string, void, unknown> {
  const model = modelId ?? process.env.DEFAULT_MODEL ?? 'gemini-2.0-flash';
  const preferredProvider = resolveProvider(model);
  const orderedKeys = keyManager.getOrderedKeys(preferredProvider);

  if (orderedKeys.length === 0) {
    throw new Error(
      'No active AI API key found. Please set GROQ_API_KEY (free from https://console.groq.com) or GEMINI_API_KEY (from https://aistudio.google.com) in your .env file.'
    );
  }

  let lastError: unknown;
  let lastProvider = preferredProvider;

  for (const keyEntry of orderedKeys) {
    const isRetry = keyEntry !== orderedKeys[0];
    if (isRetry) {
      console.log(`[AI] Falling back to ${keyEntry.provider} (key: ${keyEntry.key.slice(0, 8)}…)`);
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
      lastProvider = keyEntry.provider;

      const status = (err as { status?: number }).status;
      const isAuthError =
        status === 401 ||
        (err instanceof Error &&
          (err.message.includes('API_KEY_INVALID') ||
            err.message.toLowerCase().includes('api key not valid') ||
            err.message.toLowerCase().includes('invalid api key')));

      keyManager.markFailure(keyEntry, isAuthError);

      if (isAuthError) {
        console.warn(`[AI] Auth error on ${keyEntry.provider}, skipping remaining keys for ${keyEntry.provider}.`);
      }
    }
  }

  throw new Error(humanize(lastError, lastProvider));
}

