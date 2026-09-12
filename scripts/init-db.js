const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL || 'postgresql://admin:eY%7D%3Ex%23u%5Ev%236%3FC3r3@103.93.162.19:5432/pos?schema=public';

async function init() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Connected to PostgreSQL database at 103.93.162.19:5432/pos');

  // Ensure _migrations table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Ensure doku_settings column
  await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS doku_settings TEXT;`);

  // Save DOKU configuration for the default resto tenant
  const dokuConfig = JSON.stringify({
    enabled: true,
    clientId: 'BRN-0232-1788668958800',
    secretKey: 'SK-ePUnXcEg73lttDKzMQS5',
    apiKey: 'doku_key_ad4e81ce69f3459c815eae45ba7d8183',
    publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn+jIsijtvIE9VgD0QLTohw1YcvN3KRWwRx20fpZqz0fwUZYj0AFZ27dzr7ICkzcMVbysaijJXx2/OMMFabEU8aWPOxodSKZLb1Sbax7fpJ3fsE0fu/0ESQPg+zb/v9D2VA2u81YBnbB16hRSf+uP//UYGcZxrFEZSWk6dCKsaDuZEfnRRUwXiyFrdn8B3RPjc1ttAsue9CgXDAtp0WMbzsz2LMwtFxeTpnt/kTdbofR1K6WuwPPxeYKEeh86HHQp4C0to2yGTgo6xSPlUdTs7SNsE6WZhK4hTTnsZ06gx+5WDB6AEfT02nnOrXmK803d7KUGLurFl/Lcp8pGKeuMMwIDAQAB\n-----END PUBLIC KEY-----',
    isProduction: true
  });

  await client.query(`UPDATE settings SET doku_settings = $1 WHERE id = 'default'`, [dokuConfig]);
  console.log('✅ Updated default tenant settings with DOKU credentials in PostgreSQL.');

  // Mark existing baseline migrations
  const migrations = ['20260622000000_initial_schema.sql', '20260622000001_orders_realtime.sql'];
  for (const m of migrations) {
    await client.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [m]);
  }
  console.log('✅ Baseline migrations marked as applied in _migrations.');

  // Check row count of tables
  const tables = ['users', 'products', 'categories', 'customers', 'suppliers', 'transactions', 'settings', 'tables', 'customer_orders'];
  for (const t of tables) {
    const { rows } = await client.query(`SELECT COUNT(*) as count FROM "${t}"`);
    console.log(`  • ${t}: ${rows[0].count} records`);
  }

  await client.end();
}

init().catch(err => {
  console.error('Initialization error:', err);
  process.exit(1);
});
