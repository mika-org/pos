#!/usr/bin/env node
/**
 * ViorePos - PostgreSQL Migration Runner
 * ========================================
 * Applies SQL migration files to PostgreSQL directly using pg client.
 *
 * Usage:
 *   npm run migrate              → Apply all pending migrations
 *   npm run migrate:dry          → Show files that would be applied
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ─── Load .env / .env.local ──────────────────────────────────────────────────
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`✅ Loaded environment from ${file}`);
      return;
    }
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:eY%7D%3Ex%23u%5Ev%236%3FC3r3@103.93.162.19:5432/pos?schema=public';

async function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   ViorePos — PostgreSQL Migration CLI    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const isDryRun = process.argv.includes('--dry-run');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL successfully.\n');

    // Ensure _migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No migrations directory found at', migrationsDir);
      await client.end();
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(appliedRows.map(r => r.name));

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✨ All migrations are up to date! (0 pending)');
      await client.end();
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    pending.forEach(f => console.log(`  • ${f}`));

    if (isDryRun) {
      console.log('\n[Dry-run] No migrations applied.');
      await client.end();
      return;
    }

    console.log('\nApplying migrations...');
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`⏳ Applying ${file}...`);
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ ${file} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error applying ${file}:`, err.message);
        throw err;
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
