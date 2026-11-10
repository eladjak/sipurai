import test from 'node:test';
import assert from 'node:assert/strict';
import deleteHandler from '../api/account/delete.js';
import { deleteAccount, createSupabaseAccountStore, DELETE_MESSAGES } from '../api/_lib/accountDeletion.js';
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
const env = { CLERK_SECRET_KEY: 'sk_test_fake', ACCOUNT_DELETE_ENABLED: 'true' };
const URL_B = 'https://x.supabase.co/storage/v1/object/public/sipurai-images/generated/b-1.png';

/* ============ orchestration: an in-memory world with the same interface as the Supabase store ============ */
function world({ sub = [], orders = [], hooks = {} } = {}) {
  const db = {
    books: [{ id: 1, created_by: 'user_A', cover: URL_B /* A planted a link to B's file */ }, { id: 2, created_by: 'user_B', cover: URL_B }],
    profiles: [{ clerk_id: 'user_A', email: 'a@example.com' }, { clerk_id: 'user_B', email: 'b@example.com' }],
    subscriptions: [...sub],
    // storage objects with their STORAGE owner (written by Storage from the JWT, not by the client)
    objects: [
      { name: 'generated/a-1.png', owner: 'user_A' },
      { name: 'generated/a-orphan.png', owner: 'user_A' }, // no row refers to it
      { name: 'generated/b-1.png', owner: 'user_B' },
    ],
    tombstones: new Map(),
    orders: [...orders],
  };
  const log = { removed: [], clerk: [], blockersEmail: [], ownedFilesCalls: [] };
  const store = {
    async tombstone(id) { return db.tombstones.get(id) || null; },
    async profileEmail(id) { return db.profiles.find((p) => p.clerk_id === id)?.email || null; },
    async blockers(id, email) {
      log.blockersEmail.push(email);
      const out = [];
      if (db.subscriptions.some((s) => s.user_email === email && s.plan !== 'free' && !['canceled', 'expired'].includes(s.status))) out.push('paid_subscription');
      if (db.orders.some((o) => o.user_id === id && ['paid', 'in_production'].includes(o.status))) out.push('open_order');
      if (db.orders.some((o) => o.user_id === id && !['paid', 'in_production', 'shipped', 'cancelled', 'awaiting_payment'].includes(o.status))) out.push('unknown_order_status');
      return out;
    },
    async markDeleting(id, email) { db.tombstones.set(id, { email, status: 'deleting' }); },
    async ownedFiles(id) { log.ownedFilesCalls.push(id); return db.objects.filter((o) => o.owner === id).map((o) => o.name); },
    async removeFiles(paths) {
      hooks.onRemove?.(paths);
      for (const p of paths) { log.removed.push(p); db.objects = db.objects.filter((o) => o.name !== p); }
    },
    async purge(id) {
      hooks.onPurge?.();
      db.books = db.books.filter((b) => b.created_by !== id);
      db.subscriptions = db.subscriptions.filter((s) => s.user_email !== (db.profiles.find((p) => p.clerk_id === id)?.email));
      db.profiles = db.profiles.filter((p) => p.clerk_id !== id);
      return {};
    },
    async remaining(id) {
      hooks.onRemaining?.();
      return db.books.filter((b) => b.created_by === id).length + db.profiles.filter((p) => p.clerk_id === id).length + db.objects.filter((o) => o.owner === id).length;
    },
    async clearTombstone(id) { db.tombstones.delete(id); },
  };
  const consentStore = createMemoryConsentStore();
  const clerkDelete = async (id) => { hooks.onClerk?.(); log.clerk.push(id); };
  return { db, store, consentStore, clerkDelete, log };
}
const run = (w, userId = 'user_A', over = {}) => deleteAccount({ userId, store: w.store, consentStore: w.consentStore, clerkDelete: w.clerkDelete, env, ...over });

test('HIGH 1: A links to B\'s file inside A\'s own row; deleting A does NOT delete B\'s file', async () => {
  const w = world();
  const r = await run(w);
  assert.equal(r.http, 200, JSON.stringify(r.body));
  assert.ok(!w.log.removed.includes('generated/b-1.png'), 'B\'s object must not be deleted');
  assert.ok(w.db.objects.some((o) => o.name === 'generated/b-1.png'));
  assert.ok(w.db.books.some((b) => b.created_by === 'user_B'));
});

test('HIGH 2: files nobody refers to (orphans) that A owns are deleted too', async () => {
  const w = world();
  await run(w);
  assert.deepEqual(w.log.removed.sort(), ['generated/a-1.png', 'generated/a-orphan.png']);
  assert.deepEqual(w.db.objects.map((o) => o.owner), ['user_B']);
});

test('the account deleted is the token\'s: ids in body/query/headers are ignored', async () => {
  const w = world();
  const res = mkRes();
  await deleteHandler(
    { method: 'POST', headers: { 'x-user-id': 'user_B' }, query: { userId: 'user_B' }, body: { confirm: 'delete-my-account', userId: 'user_B', user_id: 'user_B', email: 'b@example.com' } },
    res,
    { auth: asUser('user_A'), store: w.store, consentStore: w.consentStore, clerkDelete: w.clerkDelete, env },
  );
  assert.equal(res.code, 200);
  assert.deepEqual(w.log.clerk, ['user_A']);
  assert.ok(w.db.profiles.some((p) => p.clerk_id === 'user_B'));
  assert.deepEqual(new Set(w.log.ownedFilesCalls), new Set(['user_A']));
});

test('switched off by default: 503, no auth, no database, nothing touched', async () => {
  const w = world();
  let authCalled = false;
  const res = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: { confirm: 'delete-my-account' } }, res, {
    auth: async () => { authCalled = true; return { ok: true, payload: { sub: 'user_A' } }; },
    store: w.store, consentStore: w.consentStore, clerkDelete: w.clerkDelete, env: { CLERK_SECRET_KEY: 'x' },
  });
  assert.equal(res.code, 503);
  assert.equal(res.body.error.code, 'disabled');
  assert.equal(authCalled, false);
  assert.equal(w.db.books.length, 2);
});

test('not signed in -> 401; no confirmation word -> 400; no Clerk secret -> 503 with nothing deleted', async () => {
  const w = world();
  const a = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: { confirm: 'delete-my-account' } }, a, { auth: noUser, store: w.store, consentStore: w.consentStore, env });
  assert.equal(a.code, 401);
  const b = mkRes();
  await deleteHandler({ method: 'POST', headers: {}, body: {} }, b, { auth: asUser('user_A'), store: w.store, consentStore: w.consentStore, env });
  assert.equal(b.code, 400);
  const r = await run(w, 'user_A', { env: { ACCOUNT_DELETE_ENABLED: 'true' } });
  assert.equal(r.http, 503);
  assert.equal(r.body.error.code, 'not_configured');
  assert.equal(w.db.books.length, 2);
  assert.equal(w.db.tombstones.size, 0);
});

test('active paid subscription blocks; an ended one does not', async () => {
  const blocked = world({ sub: [{ user_email: 'a@example.com', plan: 'family', status: 'active' }] });
  const r = await run(blocked);
  assert.equal(r.http, 409);
  assert.equal(r.body.error.code, 'paid_subscription');
  assert.equal(blocked.db.books.length, 2);
  assert.equal(blocked.db.tombstones.size, 0, 'refusal changes nothing, not even a tombstone');
  const ended = world({ sub: [{ user_email: 'a@example.com', plan: 'family', status: 'canceled' }] });
  assert.equal((await run(ended)).http, 200);
});

test('HIGH 4: an order still on its way blocks; an order in an UNKNOWN status blocks too (fail closed)', async () => {
  const open = world({ orders: [{ user_id: 'user_A', status: 'in_production' }] });
  assert.equal((await run(open)).body.error.code, 'open_order');
  const unknown = world({ orders: [{ user_id: 'user_A', status: 'refunded' }] });
  const r = await run(unknown);
  assert.equal(r.http, 409);
  assert.equal(r.body.error.code, 'unknown_order_status');
  assert.equal(unknown.db.books.length, 2);
  assert.equal(unknown.log.clerk.length, 0);
});

test('HIGH 5: a crash in the middle is reported honestly, keeps the tombstone, never touches Clerk, and a retry finishes', async () => {
  let boom = true;
  const w = world({ hooks: { onPurge: () => { if (boom) throw new Error('db hiccup'); } } });
  const r1 = await run(w);
  assert.equal(r1.http, 500);
  assert.equal(r1.body.error.stage, 'rows');
  assert.equal(r1.body.error.message_he, DELETE_MESSAGES.midway);
  assert.match(r1.body.error.message_he, /חלק מהמידע כבר נמחק/, 'must NOT claim that nothing was deleted');
  assert.deepEqual(w.log.clerk, []);
  assert.equal(w.db.tombstones.get('user_A').email, 'a@example.com');
  assert.equal(w.consentStore._rows.length, 0);
  boom = false;
  const r2 = await run(w);
  assert.equal(r2.http, 200);
  assert.deepEqual(w.log.clerk, ['user_A']);
  assert.equal(w.db.tombstones.size, 0, 'tombstone removed as the very last step');
});

test('HIGH 5: Clerk fails AFTER the profile is gone; the retry still knows the email (from the tombstone)', async () => {
  let failClerk = true;
  const w = world({ hooks: { onClerk: () => { if (failClerk) throw new Error('clerk 500'); } } });
  const r1 = await run(w);
  assert.equal(r1.http, 500);
  assert.equal(r1.body.error.stage, 'identity');
  assert.equal(r1.body.error.message_he, DELETE_MESSAGES.identity);
  assert.equal(w.db.profiles.some((p) => p.clerk_id === 'user_A'), false, 'profile already gone');
  failClerk = false;
  const r2 = await run(w);
  assert.equal(r2.http, 200);
  assert.equal(w.log.blockersEmail.at(-1), 'a@example.com', 'email came from the tombstone, not from the (deleted) profile');
});

test('verification loop: anything still left after a pass triggers another pass; after 3 passes Clerk is NOT deleted', async () => {
  let remainingCalls = 0;
  const w = world({ hooks: { onRemaining: () => { remainingCalls++; } } });
  w.store.remaining = async () => { remainingCalls++; return 2; };
  const r = await run(w);
  assert.equal(r.http, 500);
  assert.equal(r.body.error.code, 'incomplete');
  assert.equal(remainingCalls, 3);
  assert.deepEqual(w.log.clerk, []);
});

test('a leftover tombstone after success is reported as success with a warning, not as a failure', async () => {
  const w = world();
  w.store.clearTombstone = async () => { throw new Error('cannot clear'); };
  const r = await run(w);
  assert.equal(r.http, 200);
  assert.equal(r.body.warning, 'marker_left');
});

/* ============ the real Supabase store, against a recording fake client ============ */
function fakeDb({ errors = {}, rows = {}, rpcRows = [] } = {}) {
  const calls = [];
  const from = (table) => {
    const rec = { table, op: 'select', filters: [], payload: undefined };
    const chain = {
      select(cols, opts) { rec.cols = cols; rec.head = !!opts?.head; return chain; },
      delete() { rec.op = 'delete'; return chain; },
      update(p) { rec.op = 'update'; rec.payload = p; return chain; },
      upsert(p) { rec.op = 'upsert'; rec.payload = p; return chain; },
      eq(c, v) { rec.filters.push(['eq', c, v]); return chain; },
      ilike(c, v) { rec.filters.push(['ilike', c, v]); return chain; },
      in(c, v) { rec.filters.push(['in', c, v]); return chain; },
      limit() { return chain; },
      then(resolve) {
        calls.push(rec);
        const error = errors[table] || null;
        resolve({ data: error ? null : (rows[table] || []), error, count: 0 });
      },
    };
    return chain;
  };
  const rpcCalls = [];
  return {
    calls, rpcCalls, from,
    rpc: async (fn, args) => { rpcCalls.push([fn, args]); return { data: rpcRows, error: null }; },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
  };
}

test('HIGH 1/2 (real store): file list comes ONLY from the owner function with the token user; no row is read for paths', async () => {
  const db = fakeDb({ rpcRows: [{ name: 'generated/a-1.png' }] });
  const store = createSupabaseAccountStore(db);
  const paths = await store.ownedFiles('user_A');
  assert.deepEqual(paths, ['generated/a-1.png']);
  assert.deepEqual(db.rpcCalls, [['sipurai_owned_storage_paths', { p_user: 'user_A' }]]);
  assert.equal(db.calls.length, 0, 'no table was read to decide which files to delete');
});

test('MEDIUM 6: a schema-cache or missing-table error on a REQUIRED table stops the deletion', async () => {
  for (const table of ['books', 'profiles', 'subscriptions', 'follows']) {
    const db = fakeDb({ errors: { [table]: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` } } });
    await assert.rejects(() => createSupabaseAccountStore(db).purge('user_A', 'a@example.com'), new RegExp(table), table);
  }
});

test('MEDIUM 6: only the explicitly optional tables may be absent, and only for their own name', async () => {
  const ok = fakeDb({ errors: { print_orders: { code: 'PGRST205', message: "Could not find the table 'public.print_orders' in the schema cache" } } });
  await createSupabaseAccountStore(ok).purge('user_A', 'a@example.com'); // tolerated
  const other = fakeDb({ errors: { print_orders: { code: 'PGRST205', message: "Could not find the table 'public.something_else' in the schema cache" } } });
  await assert.rejects(() => createSupabaseAccountStore(other).purge('user_A', null), /print_orders/);
  const generic = fakeDb({ errors: { generation_loose_daily: { code: '57014', message: 'canceling statement due to statement timeout' } } });
  await assert.rejects(() => createSupabaseAccountStore(generic).purge('user_A', null), /generation_loose_daily/);
});

test('HIGH 4 (real store): finished and cancelled orders are made anonymous, an unknown status refuses', async () => {
  const db = fakeDb({ rows: { print_orders: [{ id: 'o1', status: 'shipped', quote: { bookTitle: 'הספר של דנה', priceVersion: 3 } }, { id: 'o2', status: 'cancelled' }] } });
  const n = await createSupabaseAccountStore(db).purge('user_A', null);
  assert.equal(n.orders_anonymized, 2);
  const updates = db.calls.filter((c) => c.table === 'print_orders' && c.op === 'update');
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0].payload, { user_id: 'deleted:o1', address: null, checkout_url: null, tracking_url: null, vendor_last_error: null, book_id: 'deleted', quote: { bookTitle: '', priceVersion: 3 } });
  const bad = fakeDb({ rows: { print_orders: [{ id: 'o9', status: 'refunded' }] } });
  await assert.rejects(() => createSupabaseAccountStore(bad).purge('user_A', null), /refusing status refunded/);
});

test('HIGH 4 (real store): blockers fail closed on unknown order status and on a paid plan that is not clearly ended', async () => {
  const unknownOrder = fakeDb({ rows: { print_orders: [{ status: 'refunded' }] } });
  assert.ok((await createSupabaseAccountStore(unknownOrder).blockers('user_A', null)).includes('unknown_order_status'));
  const pastDue = fakeDb({ rows: { subscriptions: [{ plan: 'family', status: 'past_due' }] } });
  assert.ok((await createSupabaseAccountStore(pastDue).blockers('user_A', 'a@example.com')).includes('paid_subscription'));
  const ended = fakeDb({ rows: { subscriptions: [{ plan: 'family', status: 'canceled' }] } });
  assert.deepEqual(await createSupabaseAccountStore(ended).blockers('user_A', 'a@example.com'), []);
});

test('real store: email lookups are exact matches (an underscore in an address must not match someone else)', async () => {
  const db = fakeDb();
  await createSupabaseAccountStore(db).blockers('user_A', 'a_b@Example.com');
  await createSupabaseAccountStore(db).purge('user_A', 'a_b@Example.com');
  assert.equal(db.calls.some((c) => c.filters.some((f) => f[0] === 'ilike')), false, 'no ilike (wildcard) filter');
});

test('real store: the profile row is deleted LAST', async () => {
  const db = fakeDb();
  await createSupabaseAccountStore(db).purge('user_A', 'a@example.com');
  const deletes = db.calls.filter((c) => c.op === 'delete');
  assert.equal(deletes.at(-1).table, 'profiles');
});

test('consent record uses the current version constant (sanity link between the two systems)', () => {
  assert.match(CURRENT_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

/* ============ parked: with the switches off the delete route does NOTHING ============ */
test('PARKED: with the switches off the route makes zero auth, database, storage, Clerk or network calls', async () => {
  const calls = [];
  const spy = (name) => new Proxy({}, { get: (_t, prop) => (...a) => { calls.push(`${name}.${String(prop)}`); return Promise.resolve(null); } });
  const fetchImpl = (...a) => { calls.push('fetch'); return Promise.resolve({ ok: true, status: 200 }); };
  for (const envVariant of [{}, { ACCOUNT_DELETE_ENABLED: 'false' }, { ACCOUNT_DELETE_ENABLED: 'TRUE ' }, { CLERK_SECRET_KEY: 'sk_live_x' }]) {
    const res = mkRes();
    await deleteHandler(
      { method: 'POST', headers: { authorization: 'Bearer x' }, body: { confirm: 'delete-my-account' } },
      res,
      { env: envVariant, auth: async () => { calls.push('auth'); return { ok: true, payload: { sub: 'user_A' } }; }, store: spy('store'), consentStore: spy('consent'), clerkDelete: async () => { calls.push('clerk'); }, fetchImpl },
    );
    assert.equal(res.code, 503, JSON.stringify(envVariant));
    assert.equal(res.body.error.code, 'disabled');
  }
  assert.deepEqual(calls, [], 'not one call may happen while deletion is switched off');
});
