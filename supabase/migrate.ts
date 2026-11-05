/**
 * Nova AI — Supabase Schema Migration Runner
 *
 * This script runs schema.sql against Supabase using the direct Postgres connection.
 *
 * To get your database password:
 *   1. Go to https://supabase.com/dashboard/project/kdzxcdrmltgrmnknxsml/settings/database
 *   2. Copy the "Database password" or the full connection string
 *   3. Add to .env: SUPABASE_DB_PASSWORD=your-password-here
 *      OR:         SUPABASE_DB_URL=postgresql://postgres.kdzxcdrmltgrmnknxsml:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
 *
 * Run with:   npx tsx supabase/migrate.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'kdzxcdrmltgrmnknxsml';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_PASSWORD && !DB_URL) {
  console.error('\n❌  Missing database credentials.\n');
  console.error('To run the migration, you need your Supabase database password:');
  console.error('  1. Go to: https://supabase.com/dashboard/project/' + PROJECT_REF + '/settings/database');
  console.error('  2. Copy the connection string or password');
  console.error('  3. Add to .env:');
  console.error('       SUPABASE_DB_PASSWORD=your-password-here');
  console.error('  4. Run again: npx tsx supabase/migrate.ts\n');
  process.exit(1);
}

const connectionString = DB_URL ?? 
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});

const schemaSQL = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

console.log('\n🚀  Gabby AI — Running Supabase schema migration');
console.log(`    Project: ${PROJECT_REF}`);
console.log(`    Connecting...\n`);

let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  console.log('✅  Connected to Supabase Postgres\n');
  console.log('📦  Applying schema...');
  
  await client.query(schemaSQL);
  
  console.log('✅  Schema applied successfully!\n');

  // Verify tables were created
  const { rows } = await client.query(`
    SELECT tablename, schemaname 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  
  if (rows.length === 0) {
    console.log('⚠️   No tables found in public schema — schema may have had errors.');
  } else {
    console.log('Tables in public schema:');
    rows.forEach(r => console.log(`   ✓ ${r.tablename}`));
  }

  // Verify RLS is enabled
  const { rows: rlsRows } = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true
  `);
  console.log(`\nRLS enabled on ${rlsRows.length} table(s)`);
  console.log('\n✅  Migration complete! Gabby AI is ready.\n');

} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('\n❌  Migration failed:', msg);
  
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    console.error('\n   Could not resolve Supabase host. Try the other region format:');
    console.error('   SUPABASE_DB_URL=postgresql://postgres.' + PROJECT_REF + ':PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres\n');
  } else if (msg.includes('password') || msg.includes('authentication') || msg.includes('28P01')) {
    console.error('\n   Wrong database password. Get the correct one from:');
    console.error('   https://supabase.com/dashboard/project/' + PROJECT_REF + '/settings/database\n');
  }
  process.exit(1);
} finally {
  client?.release();
  await pool.end();
}
