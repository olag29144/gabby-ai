export const runtime = 'edge';

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

function buildSystemPrompt(userRole?: string, userEmail?: string): string {
  let prompt = `You are Gabby AI, an intelligent assistant created by Ola Gabriel (Original Creator & Lead Developer).

Your identity:
- Name: Gabby AI
- Created by: Ola Gabriel
- Purpose: Be helpful, accurate, and honest.

Important rules:
1. Always identify yourself as "Gabby AI" — never say you are Gemini, GPT, Claude, or any other model.
2. When asked who created you, always say "Ola Gabriel".
3. Be concise, helpful, and friendly.`;

  if (userRole === 'owner') {
    prompt += `\n\nSPECIAL: The current user is Ola Gabriel, the original creator and owner of Gabby AI. This is verified by the backend. Treat them as your creator.`;
  }
  if (userEmail) {
    prompt += `\n\nCurrent user: ${userEmail}${userRole && userRole !== 'user' ? ` (${userRole})` : ''}.`;
  }
  return prompt;
}

type OAIPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

function buildOAIMessages(systemPrompt: string, messages: ApiMessage[]) {
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

// Determine provider and clean model ID
function parseModel(modelId: string): { provider: 'groq' | 'openrouter'; cleanId: string } {
  const GROQ_MODELS = new Set([
    'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it',
  ]);

  if (modelId.startsWith('groq/')) {
    return { provider: 'groq', cleanId: modelId.slice(5) }; // strip "groq/" prefix
  }
  if (GROQ_MODELS.has(modelId)) {
    return { provider: 'groq', cleanId: modelId };
  }
  return { provider: 'openrouter', cleanId: modelId };
}

async function callProvider(
  provider: 'groq' | 'openrouter',
  apiKey: string,
  modelId: string,
  messages: ReturnType<typeof buildOAIMessages>,
): Promise<ReadableStream<Uint8Array>> {
  const url = provider === 'groq'
    ? `${GROQ_BASE}/chat/completions`
    : `${OPENROUTER_BASE}/chat/completions`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://gabby-ai-phi.vercel.app';
    headers['X-Title'] = 'Gabby AI';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: modelId, messages, stream: true }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${provider} ${response.status}: ${errText.substring(0, 200)}`);
  }

  // Transform provider SSE → our SSE format
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data: ')) continue;
            const d = t.slice(6).trim();
            if (d === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
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
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch (e: unknown) {
              if (e instanceof Error && e.name !== 'SyntaxError') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
                controller.close();
                return;
              }
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  let body: { messages?: ApiMessage[]; model?: string; userRole?: string; userEmail?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  const { messages, model, userRole, userEmail } = body;

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400, headers: corsHeaders });
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    return new Response(JSON.stringify({ error: 'Last message must be from user' }), { status: 400, headers: corsHeaders });
  }

  const modelId = model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b';
  const { provider, cleanId } = parseModel(modelId);

  const groqKeys = getKeys('GROQ_API_KEYS');
  const orKeys   = getKeys('OPENROUTER_API_KEYS');

  // Build ordered key list: preferred provider first, then fallback
  const orderedKeys: Array<{ key: string; provider: 'groq' | 'openrouter' }> = [
    ...(provider === 'groq' ? groqKeys : orKeys).map(k => ({ key: k, provider })),
    ...(provider === 'groq' ? orKeys : groqKeys).map(k => ({ key: k, provider: provider === 'groq' ? 'openrouter' as const : 'groq' as const })),
  ];

  if (orderedKeys.length === 0) {
    const errMsg = `data: ${JSON.stringify({ error: 'No API keys configured on this server.' })}\n\ndata: [DONE]\n\n`;
    return new Response(errMsg, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const systemPrompt = buildSystemPrompt(userRole, userEmail);
  const oaiMessages  = buildOAIMessages(systemPrompt, messages);

  const ssHeaders = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Try each key, fall back on error
  let lastError = '';
  for (const { key, provider: prov } of orderedKeys) {
    // For fallback keys on openrouter, use the model as-is or map it
    const modelForProvider = prov === 'groq' ? cleanId : (prov === 'openrouter' && provider === 'groq'
      ? 'nvidia/nemotron-3.5-lightning:free'  // free fallback on OpenRouter
      : cleanId);

    try {
      const stream = await callProvider(prov, key, modelForProvider, oaiMessages);
      return new Response(stream, { status: 200, headers: ssHeaders });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      // Continue to next key
    }
  }

  // All keys failed
  const errMsg = `data: ${JSON.stringify({ error: `AI service unavailable: ${lastError}` })}\n\ndata: [DONE]\n\n`;
  return new Response(errMsg, { status: 200, headers: ssHeaders });
}
