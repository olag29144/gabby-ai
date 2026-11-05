import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

export const conversationsRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

conversationsRouter.use(requireAuth);
conversationsRouter.use(limiter);

// ── List all conversations ────────────────────────────────────────────────────
conversationsRouter.get('/', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, title, model, pinned, is_notebook, created_at, updated_at')
    .eq('user_id', req.user!.id)
    .order('updated_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Get one conversation with messages ────────────────────────────────────────
conversationsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user!.id)
    .single();

  if (convErr || !conv) { res.status(404).json({ error: 'Conversation not found.' }); return; }

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) { res.status(500).json({ error: msgErr.message }); return; }

  res.json({ ...conv, messages: messages ?? [] });
});

// ── Create conversation ───────────────────────────────────────────────────────
conversationsRouter.post('/', async (req: Request, res: Response) => {
  const { id, title, model, pinned, isNotebook } = req.body as {
    id?: string; title?: string; model?: string; pinned?: boolean; isNotebook?: boolean;
  };

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      id,
      user_id: req.user!.id,
      title: title ?? 'New conversation',
      model: model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b',
      pinned: pinned ?? false,
      is_notebook: isNotebook ?? false,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// ── Update conversation ───────────────────────────────────────────────────────
conversationsRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, model, pinned, isNotebook } = req.body as {
    title?: string; model?: string; pinned?: boolean; isNotebook?: boolean;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (model !== undefined) updates.model = model;
  if (pinned !== undefined) updates.pinned = pinned;
  if (isNotebook !== undefined) updates.is_notebook = isNotebook;

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user!.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: 'Conversation not found.' }); return; }
  res.json(data);
});

// ── Delete conversation ───────────────────────────────────────────────────────
conversationsRouter.delete('/:id', async (req: Request, res: Response) => {
  const { error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ message: 'Deleted.' });
});

// ── List messages for a conversation ─────────────────────────────────────────
conversationsRouter.get('/:id/messages', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Add message ───────────────────────────────────────────────────────────────
conversationsRouter.post('/:id/messages', async (req: Request, res: Response) => {
  const { id: msgId, role, content, status, error: msgError, attachments } = req.body as {
    id?: string; role: string; content: string;
    status?: string; error?: string; attachments?: unknown[];
  };

  if (!role || !content === undefined) {
    res.status(400).json({ error: 'role and content are required.' });
    return;
  }

  // Verify user owns this conversation
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!conv) { res.status(403).json({ error: 'Access denied.' }); return; }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      id: msgId,
      conversation_id: req.params.id,
      user_id: req.user!.id,
      role,
      content,
      status: status ?? 'done',
      error: msgError ?? null,
      attachments: attachments ?? [],
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

// ── Update message (e.g. streaming update) ───────────────────────────────────
conversationsRouter.patch('/:id/messages/:msgId', async (req: Request, res: Response) => {
  const { content, status, error: msgError } = req.body as {
    content?: string; status?: string; error?: string;
  };

  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;
  if (msgError !== undefined) updates.error = msgError;

  const { error } = await supabaseAdmin
    .from('messages')
    .update(updates)
    .eq('id', req.params.msgId)
    .eq('user_id', req.user!.id);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ message: 'Updated.' });
});

// ── User preferences ──────────────────────────────────────────────────────────
conversationsRouter.get('/prefs/me', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('*')
    .eq('user_id', req.user!.id)
    .single();

  if (error || !data) {
    res.json({ theme: 'dark', defaultModel: process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b', sidebarOpen: true });
    return;
  }
  res.json({ theme: data.theme, defaultModel: data.default_model, sidebarOpen: data.sidebar_open });
});

conversationsRouter.put('/prefs/me', async (req: Request, res: Response) => {
  const { theme, defaultModel, sidebarOpen } = req.body as {
    theme?: string; defaultModel?: string; sidebarOpen?: boolean;
  };

  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert({
      user_id: req.user!.id,
      theme: theme ?? 'dark',
      default_model: defaultModel ?? process.env.DEFAULT_MODEL,
      sidebar_open: sidebarOpen ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ message: 'Preferences saved.' });
});
