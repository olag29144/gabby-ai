import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return res.status(401).json({ error: 'Invalid email or password.' });

  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name,
      role: roleData?.role ?? 'user',
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
}
