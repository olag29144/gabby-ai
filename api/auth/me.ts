import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Missing token.' });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid session.' });

  const [profileRes, roleRes] = await Promise.all([
    supabase.from('profiles').select('display_name,avatar_url').eq('id', data.user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', data.user.id).single(),
  ]);

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: profileRes.data?.display_name ?? data.user.user_metadata?.display_name,
      avatarUrl: profileRes.data?.avatar_url,
      role: roleRes.data?.role ?? 'user',
    },
  });
}
