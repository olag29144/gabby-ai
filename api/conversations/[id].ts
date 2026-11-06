import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

async function getUser(token: string | undefined) {
  if (!token) return null;
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.slice(7);
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const { id } = req.query as { id: string };
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === 'GET') {
    const [convRes, msgsRes] = await Promise.all([
      supabase.from('conversations').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at'),
    ]);
    if (convRes.error || !convRes.data) return res.status(404).json({ error: 'Not found.' });
    return res.json({ ...convRes.data, messages: msgsRes.data ?? [] });
  }

  if (req.method === 'PATCH') {
    const { title, model, pinned } = req.body as { title?: string; model?: string; pinned?: boolean };
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (model !== undefined) updates.model = model;
    if (pinned !== undefined) updates.pinned = pinned;
    const { data, error } = await supabase.from('conversations').update(updates)
      .eq('id', id).eq('user_id', user.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found.' });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    await supabase.from('conversations').delete().eq('id', id).eq('user_id', user.id);
    return res.json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
