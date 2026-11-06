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

  if (req.method === 'PATCH') {
    const { content, category, importance } = req.body as {
      content?: string; category?: string; importance?: number;
    };
    const { error } = await supabase.from('memories')
      .update({ content, category, importance, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: 'Updated.' });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('memories').delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
