/**
 * Updates Supabase auth site URL and redirect URLs for the live Vercel deployment.
 * Run: node supabase/update-site-url.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const BASE = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

// Both local and live URLs for redirect
const LIVE_URL = 'https://gabby-ai-phi.vercel.app';
const LOCAL_URL = 'http://localhost:3001';

console.log('\nUpdating Supabase auth settings...');
console.log('Live URL:', LIVE_URL);

// Check current settings
const current = await fetch(`${BASE}/auth/v1/settings`, {
  headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
});
const settings = await current.json();
console.log('Current site_url:', settings.external_url ?? settings.site_url ?? '(not set)');
console.log('Current redirect_urls:', settings.uri_allow_list ?? '(not set)');

// Supabase Management API (needs PAT) to update site URL
// Since we only have service key, we just display the instructions
console.log('\n=== ACTION REQUIRED (one time) ===');
console.log('Go to: https://supabase.com/dashboard/project/kdzxcdrmltgrmnknxsml/auth/url-configuration');
console.log('Set:');
console.log(`  Site URL: ${LIVE_URL}`);
console.log(`  Redirect URLs (add all):`);
console.log(`    ${LIVE_URL}/auth/callback`);
console.log(`    ${LOCAL_URL}/auth/callback`);
console.log(`    ${LIVE_URL}/**`);
console.log('\nThis enables OAuth (Google/GitHub) to redirect correctly after login.\n');
