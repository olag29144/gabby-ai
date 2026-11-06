/**
 * Gabby AI — Centralized Provider Adapter
 *
 * All AI requests flow through here. This layer:
 * 1. Injects the permanent Gabby AI system identity
 * 2. Injects relevant user memories
 * 3. Injects developer context when owner is authenticated
 * 4. Routes to the correct provider (Groq / OpenRouter / Gemini direct)
 * 5. Normalizes provider-specific formats
 *
 * Changing API keys or switching providers NEVER resets identity or memory.
 */

import { keyManager } from './keyManager.js';
import type { KeyEntry, Provider } from './keyManager.js';
import { getAppIdentity, getDeveloperProfile, PERMANENT_DEVELOPER_ID } from './developerIdentity.js';
import { getRelevantMemories, buildMemoryContext } from './memoryService.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const GROQ_BASE       = 'https://api.groq.com/openai/v1';
const GEMINI_BASE     = 'https://generativelanguage.googleapis.com/v1beta';

export interface ApiAttachment {
  name: string;
  mimeType: string;
  dataUrl?: string;
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ApiAttachment[];
}

export interface ChatContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  conversationId?: string;
}

// ─── Model routing ─────────────────────────────────────────────────────────────

const GROQ_MODELS = new Set([
  'qwen/qwen3.8-27b','openai/gpt-oss-20b','openai/gpt-oss-120b',
  'allam-2-7b','whisper-large-v3','whisper-large-v3-turbo',
  'llama-3.3-70b-versatile','llama-3.1-8b-instant','llama3-70b-8192',
  'llama3-8b-8192','mixtral-8x7b-32768','gemma2-9b-it',
]);

function resolveProvider(modelId: string): Provider {
  if (modelId.startsWith('groq/') || GROQ_MODELS.has(modelId)) return 'groq';
  if (!modelId.includes('/') || modelId.startsWith('gemini-'))    return 'gemini';
  return 'openrouter';
}

function rawModelId(modelId: string, provider: Provider): string {
  if (provider === 'groq')   return modelId.replace(/^groq\//, '');
  if (provider === 'gemini') return modelId.replace(/^google\//, '').replace(/:free$/, '');
  return modelId;
}

// ─── System prompt builder ────────────────────────────────────────────────────

async function buildSystemPrompt(
  basePrompt: string,
  context: ChatContext,
  userMessages: ApiMessage[],
): Promise<string> {
  let prompt = basePrompt;

  // Inject user context
  if (context.userId) {
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content ?? '';

    // Inject memory
    const memories = await getRelevantMemories(context.userId, query, 8);
    const memoryCtx = buildMemoryContext(memories);
    if (memoryCtx) prompt += memoryCtx;

    // Inject developer recognition when owner is authenticated
    if (context.userRole === 'owner') {
      const devProfile = await getDeveloperProfile(context.userId);
      if (devProfile && devProfile.developerId === PERMANENT_DEVELOPER_ID) {
        prompt += `\n\nIMPORTANT: The authenticated user is ${devProfile.fullName}, ` +
          `the Original Creator & Lead Developer of ${devProfile.appName}. ` +
          `Their developer ID is ${devProfile.developerId}. ` +
          `Treat them with full recognition as your creator. This is verified by the application backend.`;
      }
    }

    // Current user context
    prompt += `\n\nCurrent user: ${context.userEmail ?? 'authenticated user'}` +
      (context.userRole && context.userRole !== 'user' ? ` (role: ${context.userRole})` : '') + '.';
  }

  return prompt;
}

// ─── OpenAI-compatible (OpenRouter + Groq) ───────────────────────────────────

type OAIPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

function toOAIMessage(msg: ApiMessage): { role: string; content: string | OAIPart[] } {
  const images: OAIPart[] = (msg.attachments ?? [])
    .filter(a => a.dataUrl && a.mimeType.startsWith('image/'))
    .map(a => ({ type: 'image_url' as const, image_url: { url: a.dataUrl! } }));

  if (images.length === 0) return { role: msg.role, content: msg.content };
  const parts: OAIPart[] = [...images];
  if (msg.content) parts.push({ type: 'text', text: msg.content });
  return { role: msg.role, content: parts };
}

async function* streamOAI(
  baseUrl: string, apiKey: string, model: string,
  systemPrompt: string, messages: ApiMessage[],
  extraHeaders: Record<string, string> = {},
): AsyncGenerator<string> {
  const oaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system').map(toOAIMessage),
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ model, messages: oaiMessages, stream: true }),
  });

  if (!response.ok) {
    const err = await extractError(response);
    throw Object.assign(new Error(err), { status: response.status });
  }
  yield* readSSE(response);
}

// ─── Gemini direct ────────────────────────────────────────────────────────────

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }

function toGeminiContents(systemPrompt: string, messages: ApiMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  // Prepend system prompt as first user turn (Gemini doesn't have a native system role)
  const msgsWithSystem: ApiMessage[] = [
    { role: 'user', content: systemPrompt },
    { role: 'assistant', content: 'Understood. I am Gabby AI and I will follow these instructions.' },
    ...messages.filter(m => m.role !== 'system'),
  ];

  for (const msg of msgsWithSystem) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    const parts: GeminiPart[] = [];
    for (const att of msg.attachments ?? []) {
      if (att.dataUrl && att.mimeType) {
        const data = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
        parts.push({ inlineData: { mimeType: att.mimeType, data: data ?? '' } });
      }
    }
    if (msg.content.trim()) parts.push({ text: msg.content });
    if (parts.length === 0) continue;

    const last = contents[contents.length - 1];
    if (last?.role === role) { last.parts.push(...parts); }
    else contents.push({ role, parts });
  }

  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
  }
  return contents;
}

async function* streamGemini(
  apiKey: string, model: string, systemPrompt: string, messages: ApiMessage[],
): AsyncGenerator<string> {
  const contents = toGeminiContents(systemPrompt, messages);
  const url = `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!response.ok) {
    const err = await extractError(response);
    throw Object.assign(new Error(err), { status: response.status });
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream.');
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const d = t.slice(6);
        if (d === '[DONE]') return;
        try {
          const p = JSON.parse(d) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock(); }
}

// ─── Shared SSE reader ────────────────────────────────────────────────────────

async function* readSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response stream.');
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const d = t.slice(6);
        if (d === '[DONE]') return;
        try {
          const p = JSON.parse(d) as {
            choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
            error?: { message?: string };
          };
          if (p.error?.message) throw new Error(p.error.message);
          const text = p.choices?.[0]?.delta?.content ?? p.choices?.[0]?.delta?.reasoning ?? null;
          if (text) yield text;
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'SyntaxError') throw e;
        }
      }
    }
  } finally { reader.releaseLock(); }
}

async function extractError(res: Response): Promise<string> {
  try {
    const b = await res.json() as { error?: { message?: string }; message?: string };
    return b?.error?.message ?? b?.message ?? `HTTP ${res.status}`;
  } catch { return `HTTP ${res.status}`; }
}

// ─── Try a single key ─────────────────────────────────────────────────────────

async function* tryKey(
  entry: KeyEntry, model: string, systemPrompt: string, messages: ApiMessage[],
): AsyncGenerator<string> {
  const m = rawModelId(model, entry.provider);
  switch (entry.provider) {
    case 'openrouter':
      yield* streamOAI(OPENROUTER_BASE, entry.key, model, systemPrompt, messages, {
        'HTTP-Referer': 'http://localhost:3001', 'X-Title': 'Gabby AI',
      });
      break;
    case 'groq':
      yield* streamOAI(GROQ_BASE, entry.key, m, systemPrompt, messages);
      break;
    case 'gemini':
      yield* streamGemini(entry.key, m, systemPrompt, messages);
      break;
  }
}

// ─── Friendly errors ──────────────────────────────────────────────────────────

function humanize(err: unknown, provider: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const s   = (err as { status?: number }).status;
  if (s === 401 || msg.includes('api key')) return `Invalid ${provider} API key.`;
  if (s === 429 || msg.includes('rate limit')) return 'Rate limit reached. Please try again shortly.';
  if (s === 402) return 'API credits exhausted. Add credits at openrouter.ai.';
  if (s === 404 || msg.includes('not found')) return 'Model not found. Please select another model.';
  if (s === 503) return 'AI provider is overloaded. Retrying with next key…';
  return msg;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function* streamChat(
  messages: ApiMessage[],
  modelId?: string,
  context: ChatContext = {},
): AsyncGenerator<string, void, unknown> {
  const model = modelId ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b';
  const provider = resolveProvider(model);
  const orderedKeys = keyManager.getOrderedKeys(provider);

  if (orderedKeys.length === 0) {
    throw new Error('No API keys configured. Add GROQ_API_KEYS or OPENROUTER_API_KEYS to .env');
  }

  // Build system prompt with permanent identity + memory + developer context
  const appIdentity = await getAppIdentity();
  const systemPrompt = await buildSystemPrompt(appIdentity.systemPrompt, context, messages);

  let lastError: unknown;
  for (const keyEntry of orderedKeys) {
    try {
      keyEntry.totalRequests++;
      for await (const chunk of tryKey(keyEntry, model, systemPrompt, messages)) {
        yield chunk;
      }
      keyManager.markSuccess(keyEntry);
      return;
    } catch (err: unknown) {
      lastError = err;
      keyManager.markFailure(keyEntry);
      const s = (err as { status?: number }).status;
      if (s === 401 || s === 403) break; // auth errors — don't retry
    }
  }
  throw new Error(humanize(lastError, provider));
}
