#!/usr/bin/env node
/**
 * One-off: find (and, only when the owner approves, delete) ORIGINAL photos that older versions of the
 * avatar upload stored in the public bucket under `uploads/`.
 *
 * Before the privacy work, AvatarSelector / AvatarStudio saved the parent's raw photo to `uploads/` and used
 * the public URL as the avatar. The new flow never stores the photo (src/lib/photoToCharacter.js), so anything
 * still under `uploads/` is a leftover original (or an overlay export from AIStudio).
 *
 * DEFAULT IS A DRY RUN: it only reads. It prints counts and, per object, owner/age/size and whether any row in
 * the database still points at it. It never prints URLs or user ids in full.
 *
 *   node scripts/cleanup-legacy-photo-uploads.mjs                # dry run (read only)
 *   CLEANUP_APPROVED_BY_OWNER=yes SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... \
 *     node scripts/cleanup-legacy-photo-uploads.mjs --apply      # deletes, ONLY after Elad approves
 *
 * A file that is still referenced as someone's avatar is listed as "referenced" and is NOT deleted by --apply
 * until that avatar has been replaced: deleting it would leave a broken picture on the parent's profile.
 * Avatar URLs held only in Clerk metadata cannot be seen from the database, so --apply also skips every
 * object younger than 30 days unless --include-recent is passed.
 *
 * Needs SUPABASE_DB_PASSWORD (env, or ../.env). Read-only in dry-run mode.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, '../.env');
const fileEnv = {};
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fileEnv[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const password = process.env.SUPABASE_DB_PASSWORD || fileEnv.SUPABASE_DB_PASSWORD;
if (!password) { console.error('FATAL: SUPABASE_DB_PASSWORD not set'); process.exit(2); }

const apply = process.argv.includes('--apply');
const includeRecent = process.argv.includes('--include-recent');
if (apply && process.env.CLEANUP_APPROVED_BY_OWNER !== 'yes') {
  console.error('REFUSED: --apply needs CLEANUP_APPROVED_BY_OWNER=yes (Elad approves this deletion first).');
  process.exit(3);
}

const client = new pg.Client({
  host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.furviizyohryyqubosut',
  password, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000,
});

const short = (s) => (s ? `${String(s).slice(0, 9)}...` : '(none)');

await client.connect();
try {
  await client.query('begin read only');
  const folders = await client.query(
    "select split_part(name,'/',1) as folder, count(*)::int n from storage.objects where bucket_id='sipurai-images' group by 1 order by 2 desc");
  console.log('Objects in the bucket by top folder:');
  console.table(folders.rows);

  const objs = await client.query(
    `select o.name, o.owner_id, o.created_at, coalesce((o.metadata->>'size')::bigint, 0) as bytes
       from storage.objects o where o.bucket_id='sipurai-images' and o.name like 'uploads/%' order by o.created_at`);
  console.log(`\nLeftover originals under uploads/: ${objs.rowCount}`);

  // Which of them does a row still point at? (profile avatars; characters; books; pages; stories)
  const refs = [
    ['profiles', 'avatar_url'], ['characters', 'primary_image_url'], ['books', 'cover_image'],
    ['pages', 'image_url']
  ];
  const referenced = new Set();
  for (const [table, col] of refs) {
    try {
      const r = await client.query(`select ${col} as v from public.${table} where ${col} like '%/uploads/%'`);
      for (const row of r.rows) for (const o of objs.rows) if (String(row.v).includes(o.name)) referenced.add(o.name);
    } catch (e) {
      console.log(`  (could not read ${table}.${col}: ${String(e.message).slice(0, 60)})`);
    }
  }
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const plan = objs.rows.map((o) => ({
    object: short(o.name.split('/')[1]), owner: short(o.owner_id), created: new Date(o.created_at).toISOString().slice(0, 10),
    kb: Math.round(Number(o.bytes) / 1024), referenced_by_a_row: referenced.has(o.name),
    action: referenced.has(o.name) ? 'KEEP (replace the avatar first)' : (!includeRecent && new Date(o.created_at).getTime() > cutoff ? 'KEEP (younger than 30 days)' : 'DELETE'),
    _name: o.name,
  }));
  if (plan.length) console.table(plan.map(({ _name, ...p }) => p));
  const del = plan.filter((p) => p.action === 'DELETE');
  console.log(`\nWould delete: ${del.length}   Would keep: ${plan.length - del.length}`);
  await client.query('rollback');

  if (!apply) {
    console.log('\nDRY RUN: nothing was deleted. Run with --apply only after the owner approves.');
  } else if (del.length) {
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for --apply');
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key, { auth: { persistSession: false } });
    for (let i = 0; i < del.length; i += 100) {
      const { error } = await db.storage.from('sipurai-images').remove(del.slice(i, i + 100).map((p) => p._name));
      if (error) throw new Error(`remove failed: ${error.message}`);
    }
    console.log(`Deleted ${del.length} objects.`);
  }
} finally {
  await client.end();
}
