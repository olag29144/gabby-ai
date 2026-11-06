import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = req.headers.authorization?.slice(7);
  if (token) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await supabase.auth.admin.signOut(token);
    } catch { /* ignore */ }
  }
  res.json({ message: 'Signed out.' });
}
