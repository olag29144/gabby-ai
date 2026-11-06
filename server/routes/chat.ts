import { Router, type Request, type Response } from 'express';
import { streamChat } from '../services/providerAdapter.js';
import { optionalAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

export const chatRouter = Router();

const limiter = rateLimit({
  windowMs: 60_000, max: 30,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true, legacyHeaders: false,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
}

chatRouter.post('/chat', limiter, optionalAuth, async (req: Request, res: Response) => {
  const { messages, model, conversationId } = req.body as {
    messages: ChatMessage[];
    model?: string;
    conversationId?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required.' }); return;
  }

  const valid = messages.filter(
    m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );

  if (valid.length === 0 || valid[valid.length - 1]?.role !== 'user') {
    res.status(400).json({ error: 'Last message must be from the user.' }); return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  try {
    const stream = streamChat(valid, model, {
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      conversationId,
    });

    for await (const text of stream) {
      if (closed) break;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    if (!closed) res.write('data: [DONE]\n\n');
  } catch (err: unknown) {
    if (!closed) {
      const message = err instanceof Error ? err.message : 'Failed to process request.';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
  } finally {
    res.end();
  }
});
