import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const SITE_URL = 'http://localhost:3001';

async function request(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SECRET,
      'Authorization': `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

// 1. Check current settings
console.log('Checking current auth settings...');
const settings = await request('/auth/v1/settings');
console.log('Status:', settings.status);
if (settings.status === 200) {
  console.log('Google enabled:', settings.data?.external?.google);
  console.log('GitHub enabled:', settings.data?.external?.github);
  console.log('Site URL:', settings.data?.external_url ?? settings.data?.site_url);
} else {
  console.log('Response:', JSON.stringify(settings.data).substring(0, 200));
}

// 2. Check if we can update settings via admin
console.log('\nChecking admin endpoints...');
const adminSettings = await request('/auth/v1/admin/users?page=1&per_page=1');
console.log('Admin users access:', adminSettings.status);

// 3. Try to update site URL and OAuth settings via the GoTrue admin endpoint
// Supabase's GoTrue /admin endpoint doesn't support settings updates via API key
// but we can configure providers via the Management API (needs PAT)
// OR we use Supabase's built-in OAuth redirect with existing settings

console.log('\n--- OAuth Setup Status ---');
console.log('To enable Google/GitHub OAuth in Supabase:');
console.log('1. Go to: https://supabase.com/dashboard/project/kdzxcdrmltgrmnknxsml/auth/providers');
console.log('2. Enable Google: add Client ID + Secret from Google Cloud Console');
console.log('3. Enable GitHub: add Client ID + Secret from GitHub OAuth Apps');
console.log('4. Set redirect URL to: http://localhost:3001/auth/callback');
console.log('');
console.log('For now, OAuth buttons will show with proper UX.');
console.log('They will work once providers are configured in the Supabase dashboard.');
