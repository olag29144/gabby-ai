import pg from 'pg';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = 'kdzxcdrmltgrmnknxsml';
const PASSWORD = 'Candaf0709@';

// Try connection variants
const variants = [
  {
    label: 'pooler eu-west-1 port 6543 (project user)',
    config: {
      host: 'aws-0-eu-west-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
      user: `postgres.${PROJECT}`,
      password: PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    }
  },
  {
    label: 'pooler eu-west-1 port 5432 (project user)',
    config: {
      host: 'aws-0-eu-west-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT}`,
      password: PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    }
  },
  {
    label: 'pooler us-east-1 port 6543',
    config: {
      host: 'aws-0-us-east-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
      user: `postgres.${PROJECT}`,
      password: PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    }
  },
];

const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

for (const variant of variants) {
  console.log(`\nTrying: ${variant.label}`);
  const client = new pg.Client(variant.config);
  try {
    await client.connect();
    console.log('✅  Connected!');
    console.log('   Running schema...');
    await client.query(schema);
    console.log('✅  Schema applied!');

    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    console.log(`   Tables created: ${rows.map(r => r.tablename).join(', ')}`);
    await client.end();
    console.log('\n✅  Migration complete!\n');
    process.exit(0);
  } catch (err) {
    console.log(`   ❌  ${err.message}`);
    try { await client.end(); } catch {}
  }
}

console.log('\n❌  All connection variants failed.');
process.exit(1);
