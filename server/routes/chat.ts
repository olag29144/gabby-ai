import { Router, type Request, type Response } from 'express';
import { streamChat } from '../services/gemini.js';
import { rateLimit } from 'express-rate-limit';

export const chatRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  conversationId?: string;
}

chatRouter.post('/chat', limiter, async (req: Request, res: Response) => {
  const { messages, model } = req.body as ChatRequest;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required.' });
    return;
  }

  const validatedMessages = messages.filter(
    m => m.role && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );

  if (validatedMessages.length === 0) {
    res.status(400).json({ error: 'No valid messages provided.' });
    return;
  }

  const lastMsg = validatedMessages[validatedMessages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') {
    res.status(400).json({ error: 'Last message must be from the user.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  try {
    const stream = streamChat(validatedMessages, model);

    for await (const text of stream) {
      if (closed) break;
      const data = JSON.stringify({ text });
      res.write(`data: ${data}\n\n`);
    }

    if (!closed) {
      res.write('data: [DONE]\n\n');
    }
  } catch (err: unknown) {
    if (!closed) {
      const message = err instanceof Error ? err.message : 'Failed to process request.';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
  } finally {
    res.end();
  }
});
