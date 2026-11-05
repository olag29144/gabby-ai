import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SECRET_KEY;

console.log('URL:', SUPABASE_URL);
console.log('Key:', SERVICE_KEY?.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test: try to read from a non-existent table to confirm connection
const { data, error } = await supabase.from('profiles').select('*').limit(1);
console.log('Connection test:', error ? 'Error: ' + error.message : 'Connected, rows: ' + (data?.length ?? 0));

// Try supabase admin sql if available (newer versions)
if (supabase.hasOwnProperty('sql') || supabase.rpc) {
  console.log('Has rpc:', typeof supabase.rpc);
  // Try running a simple SQL via rpc
  const r2 = await supabase.rpc('version', {});
  console.log('version rpc:', r2.error?.message ?? JSON.stringify(r2.data));
}
