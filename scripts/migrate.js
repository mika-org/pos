#!/usr/bin/env node
/**
 * RestoFlow POS - Supabase Migration Runner
 * ==========================================
 * Automatically applies all SQL migration files from supabase/migrations/
 * to your remote Supabase instance using the Supabase REST (rpc) API.
 *
 * Usage:
 *   npm run migrate              → Apply all pending migrations
 *   npm run migrate -- --dry-run → Show which files would be applied
 *   npm run migrate -- --file 20260622000001_orders_realtime.sql → Apply specific file
 *
 * Prerequisites:
 *   Create a .env.local file with:
 *     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 *     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   ← required for migrations
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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
      console.log(`✅ Loaded env from ${file}`);
      return;
    }
  }

  // Fallback: try to extract hardcoded values from lib/supabase.ts
  const supabaseTsPath = path.join(process.cwd(), 'lib', 'supabase.ts');
  if (fs.existsSync(supabaseTsPath)) {
    const src = fs.readFileSync(supabaseTsPath, 'utf8');
    const urlMatch = src.match(/['"`]https:\/\/[^'"`]+supabase\.co['"`]/);
    const keyMatch = src.match(/['"`](sb_publishable_[^'"`]+|eyJ[^'"`]{30,})['"`]/);
    if (urlMatch && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = urlMatch[0].replace(/['"`]/g, '');
      console.log(`✅ Extracted Supabase URL from lib/supabase.ts`);
    }
    if (keyMatch && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = keyMatch[1];
      console.log(`✅ Extracted Supabase Anon Key from lib/supabase.ts`);
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('⚠️  No .env.local or .env file found.');
    console.warn('   Create one with your Supabase credentials:\n');
    console.warn('   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
    console.warn('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    console.warn('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n');
  }
}


// ─── Simple HTTP request helper ───────────────────────────────────────────────
function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
          } catch {
            resolve({ status: res.statusCode, body: null, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Execute SQL via Supabase REST API ────────────────────────────────────────
async function executeSql(supabaseUrl, serviceKey, sql) {
  const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  const response = await request(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation',
      },
    },
    { sql }
  );
  return response;
}

// Fallback: execute SQL via the pg-compatible endpoint
async function executeSqlDirect(supabaseUrl, serviceKey, sql) {
  // Supabase exposes a /pg endpoint for direct SQL (project dashboard API)
  // We use the REST RPC approach here with a helper function
  // If exec_sql doesn't exist, we'll suggest creating it
  const url = `${supabaseUrl}/rest/v1/rpc/exec_migration`;
  const response = await request(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    },
    { migration_sql: sql }
  );
  return response;
}

// ─── Track migration state via a migrations_log table ─────────────────────────
async function ensureMigrationsTable(supabaseUrl, serviceKey) {
  // Creates the migrations_log tracking table if it doesn't exist
  const sql = `
    CREATE TABLE IF NOT EXISTS public.migrations_log (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    );
    -- Enable service role access
    GRANT ALL ON public.migrations_log TO service_role;
    GRANT SELECT ON public.migrations_log TO anon, authenticated;
  `;
  return await executeSql(supabaseUrl, serviceKey, sql);
}

async function getAppliedMigrations(supabaseUrl, serviceKey) {
  const url = `${supabaseUrl}/rest/v1/migrations_log?select=filename&order=filename.asc`;
  const response = await request(url, {
    method: 'GET',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
  if (response.status === 200 && Array.isArray(response.body)) {
    return response.body.map((r) => r.filename);
  }
  return [];
}

async function markMigrationApplied(supabaseUrl, serviceKey, filename, checksum) {
  const sql = `
    INSERT INTO public.migrations_log (filename, checksum)
    VALUES ('${filename.replace(/'/g, "''")}', '${(checksum || '').replace(/'/g, "''")}')
    ON CONFLICT (filename) DO NOTHING;
  `;
  return await executeSql(supabaseUrl, serviceKey, sql);
}

// ─── Simple MD5-like checksum (FNV-1a) ───────────────────────────────────────
function checksum(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── Main runner ──────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const specificFile = (() => {
    const idx = args.indexOf('--file');
    return idx !== -1 ? args[idx + 1] : null;
  })();

  // Banner
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   RestoFlow POS — Supabase Migration CLI ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (!SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set.');
    console.error('   Create a .env.local file with your Supabase project URL.');
    process.exit(1);
  }

  if (!SERVICE_KEY && !isDryRun) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set.');
    console.warn('   The migration runner needs the service role key to execute SQL.');
    console.warn('   Find it in your Supabase Dashboard → Settings → API → service_role key\n');
    
    if (!ANON_KEY) {
      console.error('❌ No API keys found. Cannot continue.');
      process.exit(1);
    }

    console.log('💡 Falling back to anon key (may fail due to RLS). Consider setting SUPABASE_SERVICE_ROLE_KEY.\n');
  }

  const activeKey = SERVICE_KEY || ANON_KEY;
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  // Discover migration files
  let migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (specificFile) {
    migrationFiles = migrationFiles.filter((f) => f.includes(specificFile));
    if (migrationFiles.length === 0) {
      console.error(`❌ No migration matching "${specificFile}" found.`);
      process.exit(1);
    }
  }

  console.log(`📂 Migrations Directory: ${migrationsDir}`);
  console.log(`📋 Found ${migrationFiles.length} migration file(s):`);
  migrationFiles.forEach((f) => console.log(`   - ${f}`));
  console.log(`🌐 Target: ${SUPABASE_URL}\n`);

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE — No changes will be applied.\n');
    migrationFiles.forEach((f, i) => {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      const lines = sql.split('\n').length;
      console.log(`  [${i + 1}] ${f} (${lines} lines, checksum: ${checksum(sql)})`);
    });
    console.log('\n✅ Dry run complete. Run without --dry-run to apply.');
    return;
  }

  // Ensure tracking table exists
  console.log('⚙️  Checking migrations_log table...');
  const setupResult = await ensureMigrationsTable(SUPABASE_URL, activeKey);
  
  if (setupResult.status !== 200) {
    console.warn(`\n⚠️  Could not create migrations_log table (status ${setupResult.status}).`);
    console.warn('   This might be because the exec_sql RPC function does not exist yet.');
    console.warn('\n💡 To enable the migration runner, create this function in your Supabase SQL Editor:\n');
    console.log(`   CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
   RETURNS void AS $$
   BEGIN
     EXECUTE sql;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
`);
    console.warn('   Then re-run: npm run migrate\n');
    
    console.log('📋 Alternatively, copy and run these SQL files manually in your Supabase SQL Editor:');
    migrationFiles.forEach((f) => {
      console.log(`   → supabase/migrations/${f}`);
    });
    process.exit(1);
  }

  // Get already-applied migrations
  const applied = await getAppliedMigrations(SUPABASE_URL, activeKey);
  console.log(`✅ Already applied: ${applied.length} migration(s)\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Apply each migration
  for (let i = 0; i < migrationFiles.length; i++) {
    const filename = migrationFiles[i];
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const fileChecksum = checksum(sql);

    if (applied.includes(filename)) {
      console.log(`  ⏭  [${i + 1}/${migrationFiles.length}] SKIP  ${filename} (already applied)`);
      skipCount++;
      continue;
    }

    process.stdout.write(`  ⏳ [${i + 1}/${migrationFiles.length}] APPLYING ${filename}...`);
    
    try {
      const result = await executeSql(SUPABASE_URL, activeKey, sql);
      
      if (result.status >= 200 && result.status < 300) {
        await markMigrationApplied(SUPABASE_URL, activeKey, filename, fileChecksum);
        console.log(' ✅ OK');
        successCount++;
      } else {
        console.log(` ❌ FAILED (HTTP ${result.status})`);
        if (result.raw) {
          try {
            const err = JSON.parse(result.raw);
            console.error(`     Error: ${err.message || result.raw.substring(0, 200)}`);
          } catch {
            console.error(`     Response: ${result.raw.substring(0, 200)}`);
          }
        }
        failCount++;
      }
    } catch (err) {
      console.log(` ❌ FAILED`);
      console.error(`     Error: ${err.message}`);
      failCount++;
    }
  }

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log(`  ✅ Applied:  ${successCount}`);
  console.log(`  ⏭  Skipped:  ${skipCount}`);
  console.log(`  ❌ Failed:   ${failCount}`);
  console.log('════════════════════════════════════════\n');

  if (failCount > 0) {
    console.log('💡 If migrations are failing, check if the exec_sql function exists.');
    console.log('   See the instructions above, or run migrations manually via the Supabase SQL Editor.');
    process.exit(1);
  } else {
    console.log('🚀 All migrations applied successfully!\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
