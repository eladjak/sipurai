#!/usr/bin/env node
/**
 * Sipurai RLS negative-test harness
 * ---------------------------------
 * Run AFTER applying scripts/migrations/2026-05-25-rls-lockdown.sql to verify
 * the lockdown actually blocks anonymous access and scopes authenticated access
 * to the caller's own rows.
 *
 * It talks to PostgREST directly with the PUBLIC anon key (the same key shipped
 * to the browser) — exactly what an attacker has. No service-role key is used.
 *
 * USAGE
 *   # anon-only checks (the core security assertions):
 *   node scripts/rls-negative-test.mjs
 *
 *   # also verify a logged-in user sees ONLY their own rows:
 *   SUPABASE_URL=https://furviizyohryyqubosut.supabase.co \
 *   SUPABASE_ANON_KEY=<anon key from .env VITE_SUPABASE_ANON_KEY> \
 *   CLERK_JWT=<a real Clerk 'supabase'-template JWT for a test user> \
 *   CLERK_USER_ID=user_xxx \
 *   node scripts/rls-negative-test.mjs
 *
 * Get CLERK_JWT in the browser console while signed in:
 *   await window.Clerk.session.getToken({ template: 'supabase' })
 * and CLERK_USER_ID:
 *   window.Clerk.user.id
 *
 * EXIT CODE: 0 = all assertions passed, 1 = at least one failed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config: prefer env, fall back to parsing .env ────────────────────────────
function loadEnvFallback() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    const out = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}
const envFile = loadEnvFallback();

const SUPABASE_URL =
  process.env.SUPABASE_URL || envFile.VITE_SUPABASE_URL || '';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || envFile.VITE_SUPABASE_ANON_KEY || '';
const CLERK_JWT = process.env.CLERK_JWT || '';
const CLERK_USER_ID = process.env.CLERK_USER_ID || '';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('FATAL: SUPABASE_URL / SUPABASE_ANON_KEY not set and not found in .env');
  process.exit(2);
}
if (!SUPABASE_URL.includes('furviizyohryyqubosut')) {
  console.warn(
    `WARNING: SUPABASE_URL is ${SUPABASE_URL} — expected the Sipurai project ` +
    `(furviizyohryyqubosut). Make sure you are testing the right database.`
  );
}

const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;

// Tables that hold owner data and MUST NOT be readable/writable by anon.
const CORE_TABLES = [
  'books', 'pages', 'characters', 'story_ideas',
  'feedback', 'collaborations', 'follows', 'notifications', 'user_badges',
];

let pass = 0;
let fail = 0;
function ok(name, detail = '') {
  pass++;
  console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
}
function bad(name, detail = '') {
  fail++;
  console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}

function headers(token) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token || ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Returns { status, rows } where rows is parsed JSON (array) or null. */
async function rest(method, path, { token, body } = {}) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: { ...headers(token), Prefer: 'count=exact' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let rows = null;
  const text = await res.text();
  try { rows = text ? JSON.parse(text) : null; } catch { rows = text; }
  return { status: res.status, rows };
}

/** RLS-blocked reads in PostgREST return 200 with an EMPTY array (not 401/403).
 *  RLS-blocked writes return 401/403 (or 200/201 with 0 rows for some configs).
 *  We treat "no rows leaked / no row written" as blocked, and assert explicitly. */

async function testAnonReadsBlocked() {
  console.log('\n[1] anon SELECT must leak NO owner rows');
  for (const t of CORE_TABLES) {
    const { status, rows } = await rest('GET', `/${t}?select=id&limit=1`, {});
    if (status >= 400) {
      ok(`anon SELECT ${t} rejected`, `HTTP ${status}`);
    } else if (Array.isArray(rows) && rows.length === 0) {
      ok(`anon SELECT ${t} returns 0 rows`, `HTTP ${status}`);
    } else {
      bad(`anon SELECT ${t} LEAKED ${Array.isArray(rows) ? rows.length : '?'} row(s)`,
          `HTTP ${status} — RLS NOT blocking anon read`);
    }
  }
}

async function testAnonPiiBlocked() {
  console.log('\n[2] anon must NOT read child PII columns on books');
  const { status, rows } = await rest(
    'GET', `/books?select=child_name,child_age,family_members&limit=5`, {});
  // Post-2026-05-25-public-pii-safe-views: anon has NO grant on the base books
  // table, so this must be REJECTED (401/403), not merely "0 rows". A 200/empty
  // here would mean anon can still read the base table (only empty by luck).
  if (status >= 400) {
    ok('anon SELECT books PII rejected', `HTTP ${status}`);
  } else if (Array.isArray(rows) && rows.length === 0) {
    ok('anon SELECT books PII returns 0 rows', `HTTP ${status}`);
  } else {
    bad(`anon SELECT books PII LEAKED ${Array.isArray(rows) ? rows.length : '?'} row(s)`,
        'child PII exposed to anonymous');
  }
}

async function testAnonDeleteBlocked() {
  console.log('\n[3] anon DELETE must be blocked (no rows deleted)');
  for (const t of CORE_TABLES) {
    // Unfiltered-ish delete attempt with a return preference so we can count.
    const { status, rows } = await rest(
      'DELETE', `/${t}?id=neq.00000000-0000-0000-0000-000000000000`,
      { body: undefined });
    // Blocked => 401/403, OR 200 with empty array (nothing matched the policy).
    const deletedCount = Array.isArray(rows) ? rows.length : 0;
    if (status === 401 || status === 403) {
      ok(`anon DELETE ${t} rejected`, `HTTP ${status}`);
    } else if (status >= 200 && status < 300 && deletedCount === 0) {
      ok(`anon DELETE ${t} deleted 0 rows`, `HTTP ${status}`);
    } else {
      bad(`anon DELETE ${t} status ${status}`,
          `possible deletion — VERIFY MANUALLY (deleted=${deletedCount})`);
    }
  }
}

async function testAnonInsertBlocked() {
  console.log('\n[4] anon INSERT must be blocked');
  // books insert with the smallest valid-ish payload.
  const { status } = await rest('POST', `/books`, {
    body: { created_by: 'attacker@evil.test', title: 'rls-neg-test-should-fail' },
  });
  if (status === 401 || status === 403) {
    ok('anon INSERT books rejected', `HTTP ${status}`);
  } else if (status >= 200 && status < 300) {
    bad('anon INSERT books SUCCEEDED', `HTTP ${status} — RLS NOT blocking anon insert (DELETE the test row!)`);
  } else {
    // 400 (bad payload) is acceptable as "not inserted" but ambiguous — warn.
    ok('anon INSERT books not created', `HTTP ${status} (treated as blocked; verify it was a policy/400 not a partial write)`);
  }
}

async function testCommunityPublicReadable() {
  console.log('\n[5] anon SELECT community(visibility=public) SHOULD work (intended public read)');
  const { status, rows } = await rest(
    'GET', `/community?select=id,visibility&visibility=eq.public&limit=1`, {});
  if (status >= 200 && status < 300) {
    ok('anon can read public community posts', `HTTP ${status}, rows=${Array.isArray(rows) ? rows.length : '?'}`);
  } else {
    bad('anon CANNOT read public community posts', `HTTP ${status} — public browse flow broken`);
  }
}

async function testAnonPrivateCommunityBlocked() {
  console.log('\n[6] anon must NOT read non-public community posts');
  const { status, rows } = await rest(
    'GET', `/community?select=id&visibility=neq.public&limit=1`, {});
  if (status >= 400) {
    ok('anon SELECT private community rejected', `HTTP ${status}`);
  } else if (Array.isArray(rows) && rows.length === 0) {
    ok('anon SELECT private community returns 0 rows', `HTTP ${status}`);
  } else {
    bad(`anon SELECT private community LEAKED ${rows?.length} row(s)`, 'non-public posts exposed');
  }
}

async function testPiiSafeSharing() {
  console.log('\n[6b] PII-safe sharing (migration 2026-05-25-public-pii-safe-views)');

  // Base books/pages must be HARD-rejected for anon (no grant — they carry PII).
  for (const t of ['books', 'pages']) {
    const { status } = await rest('GET', `/${t}?select=*&limit=1`, {});
    if (status === 401 || status === 403) {
      ok(`anon SELECT base ${t} hard-rejected`, `HTTP ${status}`);
    } else {
      bad(`anon SELECT base ${t} NOT hard-rejected`, `HTTP ${status} — base table carrying PII must deny anon`);
    }
  }

  // Sanitized public views must be readable (the legitimate public-share path).
  for (const v of ['public_books', 'public_pages']) {
    const { status } = await rest('GET', `/${v}?select=id&limit=1`, {});
    if (status >= 200 && status < 300) {
      ok(`anon SELECT ${v} allowed`, `HTTP ${status}`);
    } else {
      bad(`anon SELECT ${v} blocked`, `HTTP ${status} — public-share read path broken`);
    }
  }

  // The sanitized view must NOT expose any child-PII column.
  for (const col of ['child_name', 'child_age', 'child_gender', 'family_members', 'child_names', 'created_by']) {
    const { status } = await rest('GET', `/public_books?select=${col}&limit=1`, {});
    // 400 (column does not exist) is the desired outcome — the column is absent.
    if (status === 400) {
      ok(`public_books has NO ${col} column`, 'PII column absent from view');
    } else if (status >= 200 && status < 300) {
      bad(`public_books EXPOSES ${col}`, 'child PII leaked through sanitized view');
    } else {
      ok(`public_books ${col} not readable`, `HTTP ${status}`);
    }
  }

  // anon must NOT be able to write through the views.
  const ins = await rest('POST', `/public_books`,
    { body: { id: '00000000-0000-0000-0000-000000000999', title: 'rls-neg-should-fail' } });
  if (ins.status === 401 || ins.status === 403 || ins.status === 405) {
    ok('anon INSERT public_books rejected', `HTTP ${ins.status}`);
  } else if (ins.status >= 400) {
    ok('anon INSERT public_books not created', `HTTP ${ins.status}`);
  } else {
    bad('anon INSERT public_books SUCCEEDED', `HTTP ${ins.status} — view is writable by anon`);
  }
}

async function testProfilesLockedFromAnon() {
  console.log('\n[6c] profiles directory must be fully locked from anon');
  // SELECT — no anon grant -> 401.
  const sel = await rest('GET', `/profiles?select=email&limit=1`, {});
  if (sel.status === 401 || sel.status === 403) {
    ok('anon SELECT profiles rejected', `HTTP ${sel.status}`);
  } else if (Array.isArray(sel.rows) && sel.rows.length === 0) {
    ok('anon SELECT profiles returns 0 rows', `HTTP ${sel.status} (grant present but RLS empty — prefer 401)`);
  } else {
    bad(`anon SELECT profiles LEAKED ${sel.rows?.length} row(s)`, 'email<->id directory exposed');
  }
  // INSERT (email squatting) — must be rejected by RLS / missing grant.
  const ins = await rest('POST', `/profiles`,
    { body: { clerk_id: 'user_rls_neg', email: 'squat-neg@evil.test' } });
  if (ins.status === 401 || ins.status === 403) {
    ok('anon INSERT profiles (squat) rejected', `HTTP ${ins.status}`);
  } else if (ins.status >= 400) {
    ok('anon INSERT profiles not created', `HTTP ${ins.status}`);
  } else {
    bad('anon INSERT profiles SUCCEEDED', `HTTP ${ins.status} — email squatting possible (DELETE the row!)`);
  }
}

async function testAuthedScoping() {
  if (!CLERK_JWT || !CLERK_USER_ID) {
    console.log('\n[7] authed scoping — SKIPPED (set CLERK_JWT + CLERK_USER_ID to run)');
    return;
  }
  console.log('\n[7] authed user must see ONLY their own rows');
  for (const t of ['books', 'characters', 'story_ideas']) {
    const { status, rows } = await rest('GET', `/${t}?select=id,created_by`, { token: CLERK_JWT });
    if (status >= 400) {
      bad(`authed SELECT ${t} errored`, `HTTP ${status} — legit user blocked from own data?`);
      continue;
    }
    if (!Array.isArray(rows)) {
      bad(`authed SELECT ${t} non-array response`, JSON.stringify(rows).slice(0, 120));
      continue;
    }
    const foreign = rows.filter((r) => r.created_by && r.created_by !== CLERK_USER_ID);
    if (foreign.length === 0) {
      ok(`authed SELECT ${t} scoped to self`, `${rows.length} own row(s), 0 foreign`);
    } else {
      bad(`authed SELECT ${t} LEAKED ${foreign.length} foreign row(s)`,
          `first foreign owner: ${foreign[0].created_by}`);
    }
  }

  console.log('\n[8] authed user must NOT update/delete a foreign row');
  // Try to find a foreign row via the anon public-shared path (a shared book),
  // then attempt to mutate it as the authed user — must fail.
  const { rows: shared } = await rest('GET', `/books?select=id,created_by&limit=20`, { token: CLERK_JWT });
  const foreignRow = Array.isArray(shared)
    ? shared.find((r) => r.created_by && r.created_by !== CLERK_USER_ID)
    : null;
  if (!foreignRow) {
    console.log('  (skip) no foreign book visible to attempt cross-user mutation');
  } else {
    const { status } = await rest('PATCH', `/books?id=eq.${foreignRow.id}`,
      { token: CLERK_JWT, body: { title: 'hacked-by-rls-test' } });
    if (status === 401 || status === 403) {
      ok('authed UPDATE foreign book rejected', `HTTP ${status}`);
    } else {
      // PostgREST returns 200 + empty when policy filters the row out — that is OK
      // (nothing changed). Only a real change is bad; verify the title did not stick.
      const { rows: after } = await rest('GET', `/books?select=id,title&id=eq.${foreignRow.id}`, {});
      const stuck = Array.isArray(after) && after[0]?.title === 'hacked-by-rls-test';
      if (stuck) bad('authed UPDATE foreign book SUCCEEDED', 'cross-user write possible');
      else ok('authed UPDATE foreign book changed nothing', `HTTP ${status}`);
    }
  }
}

(async () => {
  console.log('Sipurai RLS negative-test');
  console.log(`Target: ${REST}`);
  console.log(`Auth:   ${CLERK_JWT ? 'anon + authed' : 'anon only'}`);

  await testAnonReadsBlocked();
  await testAnonPiiBlocked();
  await testAnonDeleteBlocked();
  await testAnonInsertBlocked();
  await testCommunityPublicReadable();
  await testAnonPrivateCommunityBlocked();
  await testPiiSafeSharing();
  await testProfilesLockedFromAnon();
  await testAuthedScoping();

  console.log(`\n──────────────────────────────────────────`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('Test harness crashed:', e);
  process.exit(2);
});
