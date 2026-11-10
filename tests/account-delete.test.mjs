import test from 'node:test';
import assert from 'node:assert/strict';
import deleteHandler from '../api/account/delete.js';
import { deleteAccount, extractStoragePaths, BUCKET } from '../api/_lib/accountDeletion.js';
import { createMemoryConsentStore } from '../api/_lib/consent.js';
import { CURRENT_POLICY_VERSION } from '../api/_lib/policyVersion.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const asUser = (sub) => async () => ({ ok: true, payload: { sub } });
const noUser = async () => ({ ok: false, reason: 'no bearer token' });
const URL_A = `https://x.supabase.co${'/storage/v1/object/public/'}${BUCKET}/uploads/a-1.png`;
const URL_B = `https://x.supabase.co${'/storage/v1/object/public/'}${BUCKET}/uploads/b-1.png`;

/** Two users in one in-memory "database". Same contract as createSupabaseAccountStore. */
function world({ aSub = { plan: 'free', status: 'active' }, aOrder = null } = {}) {
  const db = {
    books: [{ id: 1, created_by: 'user_A', cover: URL_A }, { id: 2, created_by: 'user_B', cover: URL_B }],
    profiles: [{ clerk_id: 'user_A', email: 'a@example.com' }, { clerk_id: 'user_B', email: 'b@example.com' }],
    subscriptions: [{ user_email: 'a@example.com', ...aSub }, { user_email: 'b@example.com', plan: 'pro', status: 'active' }],
    orders: aOrder ? [{ user_id: 'user_A', status: aOrder }, { user_id: 'user_B', status: 'paid' }] : [{ user_id: 'user_B', status: 'paid' }],
  };
  const removedFiles = [];
  const store = {
    async profileEmail(id) { return db.profiles.find((p) => p.clerk_id === id)?.email || null; },
    async blockers(id, email) {
      const out = [];
      if (db.subscriptions.some((s) => s.user_email === email && s.status === 'active' && s.plan !== 'free')) out.push('paid_subscription');
      if (db.orders.some((o) => o.user_id === id && ['paid', 'in_production'].includes(o.status))) out.push('open_order');
      return out;
    },
    async storagePaths(id) {
      const set = new Set();
      db.books.filter((b) => b.created_by === id).forEach((b) => extractStoragePaths(b, set));
      return [...set];
    },
    async removeFiles(paths) { removedFiles.push(...paths); },
    async purge(id, email) {
      const before = db.books.length;
      db.books = db.books.filter((b) => b.created_by !== id);
      db.subscriptions = db.subscriptions.filter((s) => s.user_email !== email);
      db.profiles = db.profiles.filter((p) => p.clerk_id !== id);
      return { books: before - db.books.length };
    },
  };
  return { db, store, removedFiles };
}
const env = { CLERK_SECRET_KEY: 'sk_test_fake' };

test('user A deletes themselves; user B\'s rows and files are untouched', async () => {
  const { db, store, removedFiles } = world();
  const consentStore = createMemoryConsentStore();
  await consentStore.save({ userId: 'user_A', policyVersion: CURRENT_POLICY_VERSION, items: {}, locale: 'he', userAgent: null });
  await consentStore.save({ userId: 'user_B', policyVersion: CURRENT_POLICY_VERSION, items: {}, locale: 'he', userAgent: null });
  const clerkCalls = [];
  const res = mkRes();
  await deleteHandler(
    { method: 'POST', headers: {}, body: { confirm: 'delete-my-account' } },
    res,
    { auth: asUser('user_A'), store, consentStore, env, clerkDelete: async (id) => { clerkCalls.push(id); } },
  );
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.deepEqual(clerkCalls, ['user_A']);
  assert.deepEqual(removedFiles, ['uploads/a-1.png']);
  assert.deepEqual(db.books.map((b) => b.created_by), ['user_B']);
  assert.ok(db.profiles.some((p) => p.clerk_id === 'user_B'));
  assert.ok(db.subscriptions.some((s) => s.user_email === 'b@example.com'));
  assert.equal(consentStore._rows.some((r) => r.user_id === 'user_A'), false);
  assert.equal(consentStore._rows.some((r) => r.user_id === 'user_B'), true);
});

test('user A cannot delete user B: ids in the body, query or headers are ignored', async () => {
  const { db, store, removedFiles } = world();
  const consentStore = createMemoryConsentStore();
  const clerkCalls = [];
  const res = mkRes();
  await deleteHandler(
    {
      method: 'POST',
      headers: { 'x-user-id': 'user_B' },
      query: { userId: 'user_B' },
      body: { confirm: 'delete-my-account', userId: 'user_B', user_id: 'user_B', email: 'b@example.com', clerkId: 'user_B' },
    },
    res,
    { auth: asUser('user_A'), store, consentStore, env, clerkDelete: async (id) => { clerkCalls.push(id); } },
  );
  assert.equal(res.code, 200);
  assert.deepEqual(clerkCalls, ['user_A'], 'only the token user is sent to Clerk');
  assert.ok(db.books.some((b) => b.created_by === 'user_B'), 'B\'s book survives');
  assert.ok(db.profiles.some((p) => p.clerk_id === 'user_B'), 'B\'s profile survives');
  assert.ok(!removedFiles.includes('uploads/b-1.png'), 'B\'s file survives');
});

test('not signed in -> 401 and nothing is touched', async () => {
  const { db, store } = world();
  const res = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: { confirm: 'delete-my-account', userId: 'user_B' } }, res, { auth: noUser, store, consentStore: createMemoryConsentStore(), env });
  assert.equal(res.code, 401);
  assert.equal(db.books.length, 2);
});

test('no explicit confirmation word -> 400, nothing deleted', async () => {
  const { db, store } = world();
  const res = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: {} }, res, { auth: asUser('user_A'), store, consentStore: createMemoryConsentStore(), env });
  assert.equal(res.code, 400);
  assert.equal(db.books.length, 2);
});

test('Clerk secret not configured -> 503 and NOTHING is deleted (no half-deleted accounts)', async () => {
  const { db, store, removedFiles } = world();
  const res = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: { confirm: 'delete-my-account' } }, res, { auth: asUser('user_A'), store, consentStore: createMemoryConsentStore(), env: {} });
  assert.equal(res.code, 503);
  assert.equal(res.body.error.code, 'not_configured');
  assert.equal(db.books.length, 2);
  assert.equal(removedFiles.length, 0);
});

test('active paid subscription blocks deletion (billing would continue)', async () => {
  const { db, store } = world({ aSub: { plan: 'family', status: 'active' } });
  const r = await deleteAccount({ userId: 'user_A', store, consentStore: createMemoryConsentStore(), clerkDelete: async () => {}, env });
  assert.equal(r.http, 409);
  assert.equal(r.body.error.code, 'paid_subscription');
  assert.equal(db.books.length, 2);
});

test('a printed-book order still on its way blocks deletion', async () => {
  const { db, store } = world({ aOrder: 'in_production' });
  const r = await deleteAccount({ userId: 'user_A', store, consentStore: createMemoryConsentStore(), clerkDelete: async () => {}, env });
  assert.equal(r.http, 409);
  assert.equal(r.body.error.code, 'open_order');
  assert.equal(db.books.length, 2);
});

test('a failure midway answers 500, deletes no Clerk user, and can be retried', async () => {
  const { db, store } = world();
  let boom = true;
  const orig = store.purge;
  store.purge = async (...a) => { if (boom) throw new Error('db hiccup'); return orig(...a); };
  const clerkCalls = [];
  const clerkDelete = async (id) => { clerkCalls.push(id); };
  const r1 = await deleteAccount({ userId: 'user_A', store, consentStore: createMemoryConsentStore(), clerkDelete, env });
  assert.equal(r1.http, 500);
  assert.deepEqual(clerkCalls, [], 'Clerk user is deleted last, only after the data');
  boom = false;
  const r2 = await deleteAccount({ userId: 'user_A', store, consentStore: createMemoryConsentStore(), clerkDelete, env });
  assert.equal(r2.http, 200);
  assert.deepEqual(clerkCalls, ['user_A']);
});

test('extractStoragePaths finds uploaded files in text and nested JSON, and ignores other hosts', () => {
  const row = {
    cover: URL_A,
    meta: { pages: [{ img: `${URL_B}?t=1` }, { img: 'https://example.com/other.png' }] },
    note: 'no files here',
  };
  assert.deepEqual([...extractStoragePaths(row)].sort(), ['uploads/a-1.png', 'uploads/b-1.png']);
});
