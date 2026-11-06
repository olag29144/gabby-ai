import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const { data, error } = await sb().auth.getUser(token);
  return error ? null : data.user;
}

async function getRole(userId: string): Promise<string> {
  const { data } = await sb()
    .from('user_roles').select('role').eq('user_id', userId).single();
  return data?.role ?? 'user';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Get action from query param OR from the URL path
  // Vercel injects [action] as req.query.action
  // But also parse from URL as fallback: /api/auth/signin → "signin"
  const action = (req.query.action as string)
    || req.url?.split('/').filter(Boolean).pop()?.split('?')[0]
    || '';

  try {
    // ── POST /api/auth/signup ─────────────────────────────
    if (action === 'signup' && req.method === 'POST') {
      const { email, password, displayName } = req.body as {
        email?: string; password?: string; displayName?: string;
      };
      if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

      const supabase = sb();
      const { data, error } = await supabase.auth.admin.createUser({
        email, password,
        user_metadata: { display_name: displayName ?? email.split('@')[0] },
        email_confirm: true,
      });

      if (error) {
        const msg = error.message.includes('already registered') || error.message.includes('already been registered')
          ? 'An account with this email already exists.'
          : error.message;
        return res.status(400).json({ error: msg });
      }

      // Sign them in immediately
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr || !signInData?.session) {
        return res.status(201).json({ message: 'Account created. Please sign in.', user: { id: data.user.id, email } });
      }

      const role = await getRole(signInData.user.id);
      return res.status(201).json({
        user: {
          id: signInData.user.id,
          email: signInData.user.email,
          displayName: signInData.user.user_metadata?.display_name ?? email.split('@')[0],
          role,
        },
        session: {
          accessToken: signInData.session.access_token,
          refreshToken: signInData.session.refresh_token,
          expiresAt: signInData.session.expires_at,
        },
      });
    }

    // ── POST /api/auth/signin ─────────────────────────────
    if (action === 'signin' && req.method === 'POST') {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

      const { data, error } = await sb().auth.signInWithPassword({ email, password });
      if (error || !data.session) return res.status(401).json({ error: 'Invalid email or password.' });

      const role = await getRole(data.user.id);
      return res.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.user_metadata?.display_name,
          role,
        },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    }

    // ── POST /api/auth/signout ────────────────────────────
    if (action === 'signout' && req.method === 'POST') {
      const token = req.headers.authorization?.slice(7);
      if (token) {
        try { await sb().auth.admin.signOut(token); } catch { /* ignore */ }
      }
      return res.json({ message: 'Signed out.' });
    }

    // ── POST /api/auth/refresh ────────────────────────────
    if (action === 'refresh' && req.method === 'POST') {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });

      const { data, error } = await sb().auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) return res.status(401).json({ error: 'Session expired. Please sign in again.' });

      return res.json({
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    }

    // ── GET /api/auth/me ──────────────────────────────────
    if (action === 'me' && req.method === 'GET') {
      const token = req.headers.authorization?.slice(7);
      const user = await getUserFromToken(token);
      if (!user) return res.status(401).json({ error: 'Invalid or expired session.' });

      const supabase = sb();
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('display_name,avatar_url').eq('id', user.id).single(),
        supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
      ]);

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: profileRes.data?.display_name ?? user.user_metadata?.display_name,
          avatarUrl: profileRes.data?.avatar_url,
          role: roleRes.data?.role ?? 'user',
        },
      });
    }

    return res.status(404).json({ error: `Unknown auth action: "${action}"` });

  } catch (err: unknown) {
    console.error('[auth] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
