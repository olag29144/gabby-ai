import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const PERMANENT_DEVELOPER_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return res.status(401).json({ error: 'Invalid session.' });

  const { data: roleData } = await sb.from('user_roles').select('role').eq('user_id', userData.user.id).single();
  if (roleData?.role !== 'owner') return res.status(403).json({ error: 'Access denied. Owner required.' });

  const { data: profile } = await sb.from('developer_profiles').select('*').eq('user_id', userData.user.id).single();
  if (!profile) return res.status(404).json({ error: 'Developer profile not found. Run: npm run setup-owner' });

  res.json({
    developerId: profile.developer_id,
    permanentDeveloperId: PERMANENT_DEVELOPER_ID,
    fullName: profile.full_name,
    email: userData.user.email,
    role: profile.role,
    accessLevel: profile.access_level,
    appName: profile.app_name,
    isVerified: profile.is_verified,
    isOwner: profile.developer_id === PERMANENT_DEVELOPER_ID,
  });
}
