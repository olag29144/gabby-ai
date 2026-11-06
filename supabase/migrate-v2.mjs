import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const PROJECT = 'kdzxcdrmltgrmnknxsml';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_URL   = process.env.SUPABASE_DB_URL
  ?? `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

if (!PASSWORD && !DB_URL) {
  console.error('Missing SUPABASE_DB_PASSWORD'); process.exit(1);
}

const schema = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema-v2.sql'), 'utf8');
const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

console.log('\n🚀  Gabby AI — Running schema v2 migration\n');
let client;
try {
  client = await pool.connect();
  console.log('✅  Connected');
  await client.query(schema);
  console.log('✅  Schema v2 applied\n');

  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
  `);
  console.log('Tables:', rows.map(r => r.tablename).join(', '));

  const { rows: identity } = await client.query(
    `SELECT app_name, creator_name, creator_role FROM public.app_identity LIMIT 1`
  );
  if (identity[0]) {
    console.log(`\nApp identity: ${identity[0].app_name} by ${identity[0].creator_name} (${identity[0].creator_role})`);
  }
  console.log('\n✅  Migration complete!\n');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  client?.release();
  await pool.end();
}
