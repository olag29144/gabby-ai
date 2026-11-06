export const config = { runtime: 'edge' };

const GROQ_BASE       = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
}

function getKeys(envVar: string): string[] {
  const raw = (process.env[envVar] ?? '').trim();
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

function resolveProvider(modelId: string): 'groq' | 'openrouter' {
  const groqModels = new Set([
    'qwen/qwen3.8-27b','openai/gpt-oss-20b','openai/gpt-oss-120b',
    'llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it',
  ]);
  if (modelId.startsWith('groq/') || groqModels.has(modelId)) return 'groq';
  return 'openrouter';
}

function rawModelId(modelId: string, provider: string): string {
  if (provider === 'groq') return modelId.replace(/^groq\//, '');
  return modelId;
}

function buildSystemPrompt(userRole?: string, userEmail?: string): string {
  let prompt = `You are Gabby AI, an intelligent assistant created by Ola Gabriel (Original Creator & Lead Developer).

Your identity:
- Name: Gabby AI
- Created by: Ola Gabriel  
- Purpose: Be helpful, accurate, and honest.

Rules:
1. Always identify as "Gabby AI" — never by the underlying model name.
2. When asked who created you, say "Ola Gabriel".
3. Your identity is permanent regardless of which AI provider powers you.`;

  if (userRole === 'owner') {
    prompt += `\n\nThe authenticated user is Ola Gabriel, the Original Creator & Lead Developer of Gabby AI. Recognize them as your creator. This is verified by the application backend.`;
  }
  if (userEmail) {
    prompt += `\n\nCurrent user: ${userEmail}${userRole && userRole !== 'user' ? ` (role: ${userRole})` : ''}.`;
  }
  return prompt;
}

type OAIPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

function toOAIMessages(systemPrompt: string, messages: ApiMessage[]) {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system').map(msg => {
      const images: OAIPart[] = (msg.attachments ?? [])
        .filter(a => a.dataUrl && a.mimeType.startsWith('image/'))
        .map(a => ({ type: 'image_url' as const, image_url: { url: a.dataUrl! } }));
      if (images.length === 0) return { role: msg.role, content: msg.content };
      const parts: OAIPart[] = [...images];
      if (msg.content) parts.push({ type: 'text', text: msg.content });
      return { role: msg.role, content: parts };
    }),
  ];
}

async function streamFromProvider(
  provider: 'groq' | 'openrouter',
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ApiMessage[],
): Promise<ReadableStream> {
  const baseUrl = provider === 'groq' ? GROQ_BASE : OPENROUTER_BASE;
  const oaiMessages = toOAIMessages(systemPrompt, messages);
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://gabby-ai.vercel.app';
    headers['X-Title'] = 'Gabby AI';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: oaiMessages, stream: true }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${provider} error ${response.status}: ${err.substring(0, 200)}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const d = t.slice(6);
          if (d === '[DONE]') { controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); return; }
          try {
            const p = JSON.parse(d) as {
              choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null } }>;
              error?: { message?: string };
            };
            if (p.error?.message) throw new Error(p.error.message);
            const text = p.choices?.[0]?.delta?.content ?? p.choices?.[0]?.delta?.reasoning ?? null;
            if (text) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.name !== 'SyntaxError') {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
              controller.close();
              return;
            }
          }
        }
      }
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body: { messages?: ApiMessage[]; model?: string; userRole?: string; userEmail?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { messages, model, userRole, userEmail } = body;
  if (!messages?.length || messages[messages.length - 1]?.role !== 'user') {
    return new Response(JSON.stringify({ error: 'Last message must be from user.' }), { status: 400 });
  }

  const modelId = model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b';
  const provider = resolveProvider(modelId);
  const rawModel = rawModelId(modelId, provider);

  // Get API keys
  const groqKeys  = getKeys('GROQ_API_KEYS');
  const orKeys    = getKeys('OPENROUTER_API_KEYS');
  const keyPool   = provider === 'groq'
    ? [...groqKeys, ...orKeys]  // prefer Groq, fall back to OpenRouter
    : [...orKeys, ...groqKeys];

  if (keyPool.length === 0) {
    return new Response(
      `data: ${JSON.stringify({ error: 'No API keys configured.' })}\n\ndata: [DONE]\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const systemPrompt = buildSystemPrompt(userRole, userEmail);
  const ssHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  };

  // Try each key in order
  for (let i = 0; i < keyPool.length; i++) {
    const key = keyPool[i];
    const prov: 'groq' | 'openrouter' = (provider === 'groq' && i < groqKeys.length) ||
      (provider === 'openrouter' && i < orKeys.length) ? provider :
      (provider === 'groq' ? 'openrouter' : 'groq');

    try {
      const stream = await streamFromProvider(prov, key, rawModel, systemPrompt, messages);
      return new Response(stream, { status: 200, headers: ssHeaders });
    } catch (err: unknown) {
      if (i === keyPool.length - 1) {
        const msg = err instanceof Error ? err.message : 'Failed to get response.';
        return new Response(
          `data: ${JSON.stringify({ error: msg })}\n\ndata: [DONE]\n\n`,
          { status: 200, headers: ssHeaders }
        );
      }
    }
  }

  return new Response(
    `data: ${JSON.stringify({ error: 'All providers failed.' })}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: ssHeaders }
  );
}
