#!/usr/bin/env node
/**
 * Apply a SQL migration to the Sipurai Supabase Postgres via a DIRECT connection
 * (the Supabase MCP is pointed at the wrong project, so we connect with `pg`).
 *
 * USAGE:
 *   node scripts/apply-migration-pg.mjs scripts/migrations/<file>.sql
 *
 * DB password comes from .env SUPABASE_DB_PASSWORD (postgres superuser).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const file = process.argv[2];
if (!file) {
  console.error('USAGE: node scripts/apply-migration-pg.mjs <path-to.sql>');
  process.exit(2);
}
const env = loadEnv();
const password = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
if (!password) { console.error('FATAL: SUPABASE_DB_PASSWORD not set'); process.exit(2); }

const sql = readFileSync(resolve(__dirname, '..', file), 'utf8');

const client = new pg.Client({
  host: 'db.furviizyohryyqubosut.supabase.co',
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

(async () => {
  await client.connect();
  console.log(`Connected. Applying ${file} ...`);
  try {
    await client.query(sql);
    console.log('MIGRATION APPLIED OK');
  } catch (e) {
    console.error('MIGRATION FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})().catch((e) => { console.error('CRASH:', e.message); process.exit(1); });
