import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const PERMANENT_DEVELOPER_ID = '00000000-0000-0000-0000-000000000001';

async function getAuthedOwner(token: string | undefined) {
  if (!token) return null;
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: roleData } = await sb.from('user_roles').select('role').eq('user_id', userData.user.id).single();
  if (roleData?.role !== 'owner') return null;

  return userData.user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.slice(7);
  const user = await getAuthedOwner(token);
  if (!user) return res.status(403).json({ error: 'Access denied. Owner privileges required.' });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [profileRes, devRes, userCount, convCount, memCount, activityRes] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase.from('developer_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('memories').select('*', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('action,resource,created_at').order('created_at', { ascending: false }).limit(20),
  ]);

  // Log dashboard access
  await supabase.from('audit_logs').insert({ user_id: user.id, action: 'dashboard_accessed', resource: 'developer_dashboard' });

  const providers = [
    ...(process.env.OPENROUTER_API_KEYS ?? '').split(',').filter(Boolean).map(k => ({
      provider: 'openrouter', key: k.trim().slice(0, 12) + '…', healthy: true, totalRequests: 0, totalFailures: 0,
    })),
    ...(process.env.GROQ_API_KEYS ?? '').split(',').filter(Boolean).map(k => ({
      provider: 'groq', key: k.trim().slice(0, 12) + '…', healthy: true, totalRequests: 0, totalFailures: 0,
    })),
  ];

  res.json({
    developer: {
      developerId: devRes.data?.developer_id ?? null,
      permanentDeveloperId: PERMANENT_DEVELOPER_ID,
      fullName: devRes.data?.full_name ?? profileRes.data?.display_name ?? user.email,
      email: user.email,
      role: devRes.data?.role ?? 'owner',
      accessLevel: devRes.data?.access_level ?? 'super_admin',
      isVerified: devRes.data?.is_verified ?? false,
      isOwner: devRes.data?.developer_id === PERMANENT_DEVELOPER_ID,
    },
    app: {
      name: 'Gabby AI',
      creatorName: 'Ola Gabriel',
      creatorRole: 'Original Creator & Lead Developer',
      description: 'An intelligent AI assistant built by Ola Gabriel.',
    },
    stats: {
      totalUsers: userCount.count ?? 0,
      totalConversations: convCount.count ?? 0,
      totalMemories: memCount.count ?? 0,
    },
    providers,
    recentActivity: activityRes.data ?? [],
  });
}
