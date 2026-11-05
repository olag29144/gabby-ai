import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY — auth and cloud persistence disabled.');
}

// Admin client (service role) — bypasses RLS, only used server-side
export const supabaseAdmin = createClient(
  SUPABASE_URL ?? 'https://placeholder.supabase.co',
  SUPABASE_SECRET_KEY ?? 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a per-request client that uses the user's JWT so RLS is enforced
export function supabaseForUser(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
