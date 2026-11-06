import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, displayName } = req.body as {
    email?: string; password?: string; displayName?: string;
  };

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.admin.createUser({
    email, password,
    user_metadata: { display_name: displayName ?? email.split('@')[0] },
    email_confirm: true,
  });

  if (error) {
    const msg = error.message.includes('already registered')
      ? 'An account with this email already exists.'
      : error.message;
    return res.status(400).json({ error: msg });
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.session) {
    return res.status(201).json({ message: 'Account created. Please sign in.', user: { id: data.user.id, email } });
  }

  // Get role
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', signInData.user.id).single();

  res.status(201).json({
    user: {
      id: signInData.user.id,
      email: signInData.user.email,
      displayName: signInData.user.user_metadata?.display_name,
      role: roleData?.role ?? 'user',
    },
    session: {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      expiresAt: signInData.session.expires_at,
    },
  });
}
