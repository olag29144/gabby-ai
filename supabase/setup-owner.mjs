/**
 * Creates the permanent owner account for Ola Gabriel.
 * Safe to re-run — will not create duplicates.
 * Run once: node supabase/setup-owner.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const PROJECT = 'kdzxcdrmltgrmnknxsml';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_URL   = process.env.SUPABASE_DB_URL
  ?? `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

// Owner details — these are permanently embedded in the DB
const OWNER_EMAIL       = process.env.OWNER_EMAIL ?? 'ola@gabby.ai';
const OWNER_NAME        = 'Ola Gabriel';
const OWNER_DEVELOPER_ID = '00000000-0000-0000-0000-000000000001'; // Permanent, never changes

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

console.log('\n🔐  Gabby AI — Setting up owner account\n');

let client;
try {
  client = await pool.connect();

  // Check if owner already exists in auth.users via email match in profiles
  const existing = await client.query(
    `SELECT p.id, p.email FROM public.profiles p
     INNER JOIN public.user_roles r ON r.user_id = p.id
     WHERE r.role = 'owner' LIMIT 1`
  );

  if (existing.rows.length > 0) {
    console.log(`✅  Owner account already exists: ${existing.rows[0].email} (${existing.rows[0].id})`);
    console.log('   No changes made.\n');
    process.exit(0);
  }

  // Owner account creation requires the user to exist in auth.users
  // We look up by email in profiles (created by GoTrue trigger on signup)
  const profileByEmail = await client.query(
    `SELECT id FROM public.profiles WHERE email = $1 LIMIT 1`,
    [OWNER_EMAIL]
  );

  if (profileByEmail.rows.length === 0) {
    console.log(`⚠️   No account found for ${OWNER_EMAIL}`);
    console.log('   Please sign up first at http://localhost:3001, then re-run this script.');
    console.log(`   Use email: ${OWNER_EMAIL}\n`);
    process.exit(0);
  }

  const userId = profileByEmail.rows[0].id;
  console.log(`Found user: ${userId} (${OWNER_EMAIL})`);

  // Assign owner role
  await client.query(`
    INSERT INTO public.user_roles (user_id, role)
    VALUES ($1, 'owner')
    ON CONFLICT (user_id) DO UPDATE SET role = 'owner'
  `, [userId]);

  // Create developer profile with permanent developer_id
  await client.query(`
    INSERT INTO public.developer_profiles
      (user_id, developer_id, full_name, role, access_level, app_name, is_verified)
    VALUES ($1, $2, $3, 'owner', 'super_admin', 'Gabby AI', true)
    ON CONFLICT (user_id) DO UPDATE SET
      developer_id = $2,
      full_name    = $3,
      is_verified  = true,
      updated_at   = now()
  `, [userId, OWNER_DEVELOPER_ID, OWNER_NAME]);

  // Update profile display name
  await client.query(`
    UPDATE public.profiles SET display_name = $1 WHERE id = $2
  `, [OWNER_NAME, userId]);

  // Seed permanent developer identity memory
  await client.query(`
    INSERT INTO public.memories (user_id, content, category, importance, is_system)
    VALUES ($1, $2, 'identity', 5, true)
    ON CONFLICT DO NOTHING
  `, [
    userId,
    `I am Gabby AI, created by Ola Gabriel (Original Creator & Lead Developer). ` +
    `When Ola Gabriel is authenticated, I recognize them as my original creator and owner. ` +
    `My identity as Gabby AI is permanent and independent of any AI provider or API key.`
  ]);

  // Log the action
  await client.query(`
    INSERT INTO public.audit_logs (user_id, action, resource, details)
    VALUES ($1, 'owner_account_created', 'developer_profiles', $2)
  `, [userId, JSON.stringify({ developerName: OWNER_NAME, developerEmail: OWNER_EMAIL, developerId: OWNER_DEVELOPER_ID })]);

  console.log(`\n✅  Owner account configured:`);
  console.log(`   Name:         ${OWNER_NAME}`);
  console.log(`   Email:        ${OWNER_EMAIL}`);
  console.log(`   User ID:      ${userId}`);
  console.log(`   Developer ID: ${OWNER_DEVELOPER_ID}`);
  console.log(`   Role:         owner / super_admin`);
  console.log(`   Verified:     true\n`);

} catch (err) {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
} finally {
  client?.release();
  await pool.end();
}
