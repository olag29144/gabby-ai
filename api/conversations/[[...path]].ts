import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const { data, error } = await sb().auth.getUser(token);
  return error ? null : data.user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.slice(7);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const supabase = sb();
  const pathParts = (req.query.path as string[] | undefined) ?? [];
  const convId = pathParts[0];
  const sub = pathParts[1]; // 'messages', 'prefs'

  // /api/conversations/prefs/me
  if (convId === 'prefs') {
    if (req.method === 'GET') {
      const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).single();
      return res.json(data ?? { theme: 'dark', defaultModel: process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b', sidebarOpen: true });
    }
    if (req.method === 'PUT') {
      const { theme, defaultModel, sidebarOpen } = req.body as { theme?: string; defaultModel?: string; sidebarOpen?: boolean };
      await supabase.from('user_preferences').upsert({ user_id: user.id, theme: theme ?? 'dark', default_model: defaultModel, sidebar_open: sidebarOpen ?? true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      return res.json({ message: 'Saved.' });
    }
  }

  // /api/conversations — list or create
  if (!convId) {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('conversations').select('id,title,model,pinned,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? []);
    }
    if (req.method === 'POST') {
      const { id, title, model, pinned } = req.body as { id?: string; title?: string; model?: string; pinned?: boolean };
      const { data, error } = await supabase.from('conversations').insert({ id, user_id: user.id, title: title ?? 'New conversation', model: model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b', pinned: pinned ?? false }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }
  }

  // /api/conversations/:id/messages
  if (convId && sub === 'messages') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? []);
    }
    if (req.method === 'POST') {
      const { id: msgId, role, content, status, error: msgError, attachments } = req.body as { id?: string; role: string; content: string; status?: string; error?: string; attachments?: unknown[] };
      const { data: conv } = await supabase.from('conversations').select('id').eq('id', convId).eq('user_id', user.id).single();
      if (!conv) return res.status(403).json({ error: 'Access denied.' });
      const { data, error } = await supabase.from('messages').insert({ id: msgId, conversation_id: convId, user_id: user.id, role, content, status: status ?? 'done', error: msgError ?? null, attachments: attachments ?? [] }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }
    // PATCH /api/conversations/:id/messages/:msgId
    const msgId = pathParts[2];
    if (msgId && req.method === 'PATCH') {
      const { content, status, error: msgError } = req.body as { content?: string; status?: string; error?: string };
      const updates: Record<string, unknown> = {};
      if (content !== undefined) updates.content = content;
      if (status !== undefined) updates.status = status;
      if (msgError !== undefined) updates.error = msgError;
      await supabase.from('messages').update(updates).eq('id', msgId).eq('user_id', user.id);
      return res.json({ message: 'Updated.' });
    }
  }

  // /api/conversations/:id — get, update, delete
  if (convId && !sub) {
    if (req.method === 'GET') {
      const [convRes, msgsRes] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', convId).eq('user_id', user.id).single(),
        supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at'),
      ]);
      if (!convRes.data) return res.status(404).json({ error: 'Not found.' });
      return res.json({ ...convRes.data, messages: msgsRes.data ?? [] });
    }
    if (req.method === 'PATCH') {
      const { title, model, pinned } = req.body as { title?: string; model?: string; pinned?: boolean };
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (model !== undefined) updates.model = model;
      if (pinned !== undefined) updates.pinned = pinned;
      const { data, error } = await supabase.from('conversations').update(updates).eq('id', convId).eq('user_id', user.id).select().single();
      if (error || !data) return res.status(404).json({ error: 'Not found.' });
      return res.json(data);
    }
    if (req.method === 'DELETE') {
      await supabase.from('conversations').delete().eq('id', convId).eq('user_id', user.id);
      return res.json({ message: 'Deleted.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
