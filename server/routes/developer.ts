import { Router, type Request, type Response } from 'express';
import { requireOwner } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import {
  getDeveloperProfile, getAppIdentity, logAudit,
  invalidateAppIdentityCache, PERMANENT_DEVELOPER_ID,
} from '../services/developerIdentity.js';
import { keyManager } from '../services/keyManager.js';
import { rateLimit } from 'express-rate-limit';

export const developerRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
developerRouter.use(limiter);
developerRouter.use(requireOwner); // ALL routes require owner role

// GET /api/developer/profile — developer identity card
developerRouter.get('/profile', async (req: Request, res: Response) => {
  const profile = await getDeveloperProfile(req.user!.id);
  if (!profile) {
    res.status(404).json({ error: 'Developer profile not found. Run: npm run setup-owner' });
    return;
  }
  res.json({
    developerId: profile.developerId,
    permanentDeveloperId: PERMANENT_DEVELOPER_ID,
    fullName: profile.fullName,
    email: req.user!.email,
    role: profile.role,
    accessLevel: profile.accessLevel,
    appName: profile.appName,
    isVerified: profile.isVerified,
    isOwner: profile.developerId === PERMANENT_DEVELOPER_ID,
  });
});

// GET /api/developer/dashboard — full dashboard data
developerRouter.get('/dashboard', async (req: Request, res: Response) => {
  const [profile, appIdentity] = await Promise.all([
    getDeveloperProfile(req.user!.id),
    getAppIdentity(),
  ]);

  // Key status (masked)
  const keyStatus = keyManager.getStatus();

  // User count
  const { count: userCount } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Conversation count
  const { count: convCount } = await supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  // Memory count
  const { count: memCount } = await supabaseAdmin
    .from('memories')
    .select('*', { count: 'exact', head: true });

  // Recent audit logs (last 20)
  const { data: auditLogs } = await supabaseAdmin
    .from('audit_logs')
    .select('action, resource, details, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  await logAudit(req.user!.id, 'dashboard_accessed', 'developer_dashboard');

  res.json({
    developer: {
      developerId: profile?.developerId ?? null,
      permanentDeveloperId: PERMANENT_DEVELOPER_ID,
      fullName: profile?.fullName ?? req.user!.email,
      email: req.user!.email,
      role: profile?.role ?? 'owner',
      accessLevel: profile?.accessLevel ?? 'super_admin',
      isVerified: profile?.isVerified ?? false,
      isOwner: profile?.developerId === PERMANENT_DEVELOPER_ID,
    },
    app: {
      name: appIdentity.appName,
      creatorName: appIdentity.creatorName,
      creatorRole: appIdentity.creatorRole,
      description: appIdentity.description,
    },
    stats: {
      totalUsers: userCount ?? 0,
      totalConversations: convCount ?? 0,
      totalMemories: memCount ?? 0,
    },
    providers: keyStatus,
    recentActivity: auditLogs ?? [],
  });
});

// GET /api/developer/memories — all memories overview (privacy: shows counts per user, not content)
developerRouter.get('/memories', async (req: Request, res: Response) => {
  const { data } = await supabaseAdmin
    .from('memories')
    .select('user_id, category, importance, is_system, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  // Group by user without exposing content
  const summary = (data ?? []).reduce<Record<string, { count: number; categories: Set<string> }>>((acc, m) => {
    const uid = m.user_id;
    if (!acc[uid]) acc[uid] = { count: 0, categories: new Set() };
    acc[uid].count++;
    acc[uid].categories.add(m.category);
    return acc;
  }, {});

  res.json(
    Object.entries(summary).map(([uid, s]) => ({
      userId: uid.substring(0, 8) + '…', // partial ID for privacy
      count: s.count,
      categories: Array.from(s.categories),
    }))
  );
});

// GET /api/developer/app-identity — full app identity
developerRouter.get('/app-identity', async (_req: Request, res: Response) => {
  const identity = await getAppIdentity();
  res.json(identity);
});

// PATCH /api/developer/app-identity — update system prompt
developerRouter.patch('/app-identity', async (req: Request, res: Response) => {
  const { systemPrompt, description } = req.body as { systemPrompt?: string; description?: string };

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (systemPrompt?.trim()) updates.system_prompt = systemPrompt.trim();
  if (description?.trim())  updates.description   = description.trim();

  const { error } = await supabaseAdmin
    .from('app_identity')
    .update(updates)
    .eq('app_name', 'Gabby AI');

  if (error) { res.status(500).json({ error: error.message }); return; }

  invalidateAppIdentityCache();
  await logAudit(req.user!.id, 'app_identity_updated', 'app_identity', updates);
  res.json({ message: 'App identity updated.' });
});

// GET /api/developer/audit-logs
developerRouter.get('/audit-logs', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// POST /api/developer/verify — verify a user is the real owner (backend check)
developerRouter.post('/verify', async (req: Request, res: Response) => {
  const { claimedDeveloperId } = req.body as { claimedDeveloperId?: string };

  const profile = await getDeveloperProfile(req.user!.id);
  const isVerifiedOwner =
    profile !== null &&
    profile.isVerified &&
    profile.developerId === PERMANENT_DEVELOPER_ID &&
    (claimedDeveloperId === undefined || claimedDeveloperId === PERMANENT_DEVELOPER_ID);

  await logAudit(req.user!.id, 'owner_verification', 'developer_profiles', {
    result: isVerifiedOwner ? 'verified' : 'failed',
    claimedDeveloperId,
  });

  res.json({
    verified: isVerifiedOwner,
    developerId: isVerifiedOwner ? PERMANENT_DEVELOPER_ID : null,
    message: isVerifiedOwner
      ? 'Verified as original creator and owner of Gabby AI.'
      : 'Verification failed. Identity not confirmed.',
  });
});
