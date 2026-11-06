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

async function getRole(userId: string): Promise<string> {
  const { data } = await sb().from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role ?? 'user';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action as string;

  // POST /api/auth/signup
  if (action === 'signup' && req.method === 'POST') {
    const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const supabase = sb();
    const { data, error } = await supabase.auth.admin.createUser({
      email, password,
      user_metadata: { display_name: displayName ?? email.split('@')[0] },
      email_confirm: true,
    });
    if (error) return res.status(400).json({ error: error.message.includes('already registered') ? 'Email already in use.' : error.message });

    const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn?.session) return res.status(201).json({ message: 'Account created. Please sign in.', user: { id: data.user.id, email } });

    const role = await getRole(signIn.user.id);
    return res.status(201).json({
      user: { id: signIn.user.id, email: signIn.user.email, displayName: signIn.user.user_metadata?.display_name, role },
      session: { accessToken: signIn.session.access_token, refreshToken: signIn.session.refresh_token, expiresAt: signIn.session.expires_at },
    });
  }

  // POST /api/auth/signin
  if (action === 'signin' && req.method === 'POST') {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ error: 'Invalid email or password.' });

    const role = await getRole(data.user.id);
    return res.json({
      user: { id: data.user.id, email: data.user.email, displayName: data.user.user_metadata?.display_name, role },
      session: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at },
    });
  }

  // POST /api/auth/signout
  if (action === 'signout' && req.method === 'POST') {
    const token = req.headers.authorization?.slice(7);
    if (token) { try { await sb().auth.admin.signOut(token); } catch { /* ignore */ } }
    return res.json({ message: 'Signed out.' });
  }

  // POST /api/auth/refresh
  if (action === 'refresh' && req.method === 'POST') {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });
    const { data, error } = await sb().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return res.json({ session: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at } });
  }

  // GET /api/auth/me
  if (action === 'me' && req.method === 'GET') {
    const token = req.headers.authorization?.slice(7);
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid session.' });

    const supabase = sb();
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('display_name,avatar_url').eq('id', user.id).single(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
    ]);
    return res.json({
      user: {
        id: user.id, email: user.email,
        displayName: profileRes.data?.display_name ?? user.user_metadata?.display_name,
        avatarUrl: profileRes.data?.avatar_url,
        role: roleRes.data?.role ?? 'user',
      },
    });
  }

  return res.status(404).json({ error: 'Not found.' });
}
