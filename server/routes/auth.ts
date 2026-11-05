import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many auth attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Sign up ───────────────────────────────────────────────────────────────────
authRouter.post('/signup', authLimiter, async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name: displayName ?? email.split('@')[0] },
    email_confirm: true, // auto-confirm for now
  });

  if (error) {
    const msg = error.message.includes('already registered')
      ? 'An account with this email already exists.'
      : error.message;
    res.status(400).json({ error: msg });
    return;
  }

  // Sign them in immediately to get a session
  const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    res.status(201).json({
      message: 'Account created. Please sign in.',
      user: { id: data.user.id, email: data.user.email },
    });
    return;
  }

  res.status(201).json({
    user: {
      id: signInData.user.id,
      email: signInData.user.email,
      displayName: signInData.user.user_metadata?.display_name,
    },
    session: {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      expiresAt: signInData.session.expires_at,
    },
  });
});

// ── Sign in ───────────────────────────────────────────────────────────────────
authRouter.post('/signin', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name,
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
});

// ── Refresh token ─────────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required.' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  res.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
});

// ── Get current session / profile ────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, display_name, avatar_url, created_at')
    .eq('id', req.user!.id)
    .single();

  if (error || !data) {
    // Profile might not exist yet if schema hasn't been run — return basic info
    res.json({
      user: { id: req.user!.id, email: req.user!.email, displayName: null },
    });
    return;
  }

  res.json({
    user: {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
    },
  });
});

// ── Sign out ──────────────────────────────────────────────────────────────────
authRouter.post('/signout', requireAuth, async (req: Request, res: Response) => {
  await supabaseAdmin.auth.admin.signOut(req.accessToken!);
  res.json({ message: 'Signed out successfully.' });
});

// ── Update profile ────────────────────────────────────────────────────────────
authRouter.patch('/profile', requireAuth, async (req: Request, res: Response) => {
  const { displayName } = req.body as { displayName?: string };
  if (!displayName?.trim()) {
    res.status(400).json({ error: 'Display name is required.' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
    .eq('id', req.user!.id);

  if (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
    return;
  }

  res.json({ message: 'Profile updated.' });
});
