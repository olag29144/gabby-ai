import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

async function getUser(token: string | undefined) {
  if (!token) return null;
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

const BANNED = [/password/i, /api[_\s-]?key/i, /secret/i, /token/i, /bearer /i, /sk-/i, /AIza/i];
function isSensitive(s: string) { return BANNED.some(p => p.test(s)); }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.slice(7);
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // GET — list memories
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('memories').select('*').eq('user_id', user.id)
      .order('importance', { ascending: false }).order('updated_at', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  // POST — create memory
  if (req.method === 'POST') {
    const { content, category = 'general', importance = 1 } = req.body as {
      content?: string; category?: string; importance?: number;
    };
    if (!content?.trim()) return res.status(400).json({ error: 'content is required.' });
    if (isSensitive(content)) return res.status(400).json({ error: 'Memory may contain sensitive info.' });

    const { data, error } = await supabase
      .from('memories')
      .insert({ user_id: user.id, content: content.trim(), category, importance })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // DELETE all (non-system)
  if (req.method === 'DELETE') {
    await supabase.from('memories').delete().eq('user_id', user.id).eq('is_system', false);
    return res.json({ message: 'Cleared.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
