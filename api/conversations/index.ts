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

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('conversations').select('id,title,model,pinned,is_notebook,created_at,updated_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  if (req.method === 'POST') {
    const { id, title, model, pinned } = req.body as {
      id?: string; title?: string; model?: string; pinned?: boolean;
    };
    const { data, error } = await supabase.from('conversations').insert({
      id, user_id: user.id, title: title ?? 'New conversation',
      model: model ?? process.env.DEFAULT_MODEL ?? 'groq/qwen/qwen3.8-27b', pinned: pinned ?? false,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
