/**
 * Runs Nova AI schema.sql on Supabase via the Postgres direct connection.
 * Supabase pooler endpoint: aws-0-[region].pooler.supabase.com
 * Project ref: kdzxcdrmltgrmnknxsml
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const PROJECT_REF = 'kdzxcdrmltgrmnknxsml';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SECRET_KEY;

// Supabase pooler connection (port 6543 = transaction mode, 5432 = session mode)
const connectionString = process.env.SUPABASE_DB_URL ||
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const { Pool } = pg;

console.log(`\n🚀  Connecting to Supabase project: ${PROJECT_REF}`);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const schemaSQL = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'),
  'utf8'
);

let client;
try {
  client = await pool.connect();
  console.log('✅  Connected to Supabase Postgres\n');

  console.log('📦  Running schema...');
  await client.query(schemaSQL);
  console.log('✅  Schema applied successfully!\n');
  console.log('Tables created:');
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  rows.forEach(r => console.log(`   • ${r.tablename}`));
  console.log('');

} catch (err) {
  console.error('\n❌  Error running schema:', err.message);
  if (err.message.includes('password') || err.message.includes('authentication')) {
    console.log('\nℹ️   The SUPABASE_SECRET_KEY is a REST API key, not the database password.');
    console.log('    To get the database password:');
    console.log('    → https://supabase.com/dashboard/project/kdzxcdrmltgrmnknxsml/settings/database');
    console.log('    Add to .env: SUPABASE_DB_PASSWORD=your-db-password\n');
  }
  process.exit(1);
} finally {
  if (client) client.release();
  await pool.end();
}
