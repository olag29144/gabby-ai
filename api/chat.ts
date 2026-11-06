import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

const GROQ_BASE       = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
}

function getKeys(envVar: string): string[] {
  return (process.env[envVar] ?? '').split(',').map(k => k.trim()).filter(Boolean);
}

function parseModel(modelId: string): { provider: 'groq' | 'openrouter'; cleanId: string } {
  const GROQ_NATIVE = new Set([
    'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768',
  ]);
  if (modelId.startsWith('groq/')) return { provider: 'groq', cleanId: modelId.slice(5) };
  if (GROQ_NATIVE.has(modelId))   return { provider: 'groq', cleanId: modelId };
  return { provider: 'openrouter', cleanId: modelId };
}

function buildSystemPrompt(userRole?: string, userEmail?: string): string {
  let p = `You are Gabby AI, an intelligent assistant created by Ola Gabriel (Original Creator & Lead Developer).
Always identify yourself as "Gabby AI". Never say you are Gemini, GPT, Claude, or any other AI model.
When asked who created you, say "Ola Gabriel". Be helpful, accurate, and friendly.`;
  if (userRole === 'owner') {
    p += `\n\nThe current user is Ola Gabriel, the verified original creator and owner of Gabby AI.`;
  }
  if (userEmail) p += `\nCurrent user: ${userEmail}.`;
  return p;
}

type OAIPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

function buildOAIMessages(systemPrompt: string, messages: ApiMessage[]) {
  return [
    { role: 'system' as const, content: systemPrompt },
    ...messages.filter(m => m.role !== 'system').map(msg => {
      const imgs: OAIPart[] = (msg.attachments ?? [])
        .filter(a => a.dataUrl && a.mimeType.startsWith('image/'))
        .map(a => ({ type: 'image_url' as const, image_url: { url: a.dataUrl! } }));
      if (!imgs.length) return { role: msg.role as 'user' | 'assistant', content: msg.content };
      const parts: OAIPart[] = [...imgs];
      if (msg.content) parts.push({ type: 'text', text: msg.content });
      return { role: msg.role as 'user' | 'assistant', content: parts };
    }),
  ];
}

async function streamFromProvider(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: ReturnType<typeof buildOAIMessages>,
  extraHeaders: Record<string, string>,
  res: VercelResponse,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({ model: modelId, messages, stream: true }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err.substring(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('data: ')) continue;
      const d = t.slice(6).trim();
      if (d === '[DONE]') {
        res.write('data: [DONE]\n\n');
        return;
      }
      try {
        const parsed = JSON.parse(d) as {
          choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
          error?: { message?: string };
        };
        if (parsed.error?.message) throw new Error(parsed.error.message);
        const text = parsed.choices?.[0]?.delta?.content
          ?? parsed.choices?.[0]?.delta?.reasoning
          ?? null;
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'SyntaxError') throw e;
      }
    }
  }
  res.write('data: [DONE]\n\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, model, userRole, userEmail } = req.body as {
    messages?: ApiMessage[];
    model?: string;
    userRole?: string;
    userEmail?: string;
  };

  if (!messages?.length || messages[messages.length - 1]?.role !== 'user') {
    return res.status(400).json({ error: 'Last message must be from user.' });
  }

  const modelId = model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b';
  const { provider, cleanId } = parseModel(modelId);

  const groqKeys = getKeys('GROQ_API_KEYS');
  const orKeys   = getKeys('OPENROUTER_API_KEYS');

  const orderedKeys: Array<{ key: string; provider: 'groq' | 'openrouter'; id: string }> = [
    ...(provider === 'groq' ? groqKeys : orKeys).map(k => ({ key: k, provider, id: cleanId })),
    // Fallback: if groq fails try openrouter with a free model, and vice versa
    ...(provider === 'groq'
      ? orKeys.map(k => ({ key: k, provider: 'openrouter' as const, id: 'nvidia/nemotron-3.5-lightning:free' }))
      : groqKeys.map(k => ({ key: k, provider: 'groq' as const, id: 'qwen/qwen3.8-27b' }))),
  ];

  if (orderedKeys.length === 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ error: 'No API keys configured.' })}\n\ndata: [DONE]\n\n`);
    return res.end();
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const systemPrompt = buildSystemPrompt(userRole, userEmail);
  const oaiMessages  = buildOAIMessages(systemPrompt, messages);

  let lastError = '';
  for (const { key, provider: prov, id } of orderedKeys) {
    const baseUrl = prov === 'groq' ? GROQ_BASE : OPENROUTER_BASE;
    const extraHeaders: Record<string, string> = prov === 'openrouter'
      ? { 'HTTP-Referer': 'https://gabby-ai-phi.vercel.app', 'X-Title': 'Gabby AI' }
      : {};

    try {
      await streamFromProvider(baseUrl, key, id, oaiMessages, extraHeaders, res);
      return res.end();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[chat] ${prov} failed:`, lastError);
      // Continue to next key
    }
  }

  // All failed
  res.write(`data: ${JSON.stringify({ error: `All AI providers failed: ${lastError}` })}\n\ndata: [DONE]\n\n`);
  res.end();
}
