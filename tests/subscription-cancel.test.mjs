import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/subscription/cancel.js';
import { createSupabaseSubscriptionStore, verifiedEmail } from '../api/_lib/subscriptionCancel.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const asUser = (sub, email, extra = {}) => async () => ({ ok: true, payload: { sub, ...(email ? { email } : {}), ...extra } });
const EMAIL = { user_A: 'a@example.com', user_B: 'b@example.com' };
const noUser = async () => ({ ok: false });
const env = { CREEM_API_KEY: 'ck_test_fake' };
// keyed by the VERIFIED email, like the real store
const storeFor = (map) => ({ async activeSubscription(email) { return map[email] || null; } });
const run = (over, method = 'POST') => { const res = mkRes(); return handler({ method, headers: {}, body: {} }, res, over).then(() => res); };
const sub = { plan: 'premium', status: 'active', current_period_end: '2026-12-01', creem_subscription_id: 'sub_123' };

test('anonymous is refused', async () => {
  assert.equal((await run({ auth: noUser, env, store: storeFor({}) })).code, 401);
});

test('GET tells whether a paid subscription exists, only for the signed-in user', async () => {
  const store = storeFor({ [EMAIL.user_A]: sub });
  const a = await run({ auth: asUser('user_A', EMAIL.user_A), env, store }, 'GET');
  assert.equal(a.body.active, true);
  const b = await run({ auth: asUser('user_B', EMAIL.user_B), env, store }, 'GET');
  assert.equal(b.body.active, false);
});

test('POST cancels at Creem with the documented endpoint, header and body; secret never in the answer', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  const res = await run({ auth: asUser('user_A', EMAIL.user_A), env, store: storeFor({ [EMAIL.user_A]: sub }), fetchImpl });
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.creem.io/v1/subscriptions/sub_123/cancel');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['x-api-key'], 'ck_test_fake');
  assert.equal(JSON.parse(calls[0].init.body).mode, 'immediate');
  assert.ok(!JSON.stringify(res.body).includes('ck_test_fake'));
});

test('another user cannot cancel someone else\'s subscription: no provider call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true }; };
  const res = await run({ auth: asUser('user_B', EMAIL.user_B), env, store: storeFor({ [EMAIL.user_A]: sub }), fetchImpl });
  assert.equal(res.code, 404);
  assert.equal(called, false);
});

test('provider failure is shown as a Hebrew error and is not reported as success', async () => {
  const res = await run({ auth: asUser('user_A', EMAIL.user_A), env, store: storeFor({ [EMAIL.user_A]: sub }), fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(res.code, 502);
  assert.match(res.body.error.message_he, /לא בוטל כלום/);
});

test('no API key configured: refuses without calling anyone', async () => {
  let called = false;
  const res = await run({ auth: asUser('user_A', EMAIL.user_A), env: {}, store: storeFor({ [EMAIL.user_A]: sub }), fetchImpl: async () => { called = true; return { ok: true }; } });
  assert.equal(res.code, 503);
  assert.equal(called, false);
});

test('a subscription row without a Creem id cannot be cancelled online (mailto fallback)', async () => {
  const res = await run({ auth: asUser('user_A', EMAIL.user_A), env, store: storeFor({ [EMAIL.user_A]: { ...sub, creem_subscription_id: null } }) });
  assert.equal(res.code, 409);
});

test('network error / timeout at Creem says the outcome is UNCERTAIN, never "nothing was cancelled"', async () => {
  const res = await run({ auth: asUser('user_A', EMAIL.user_A), env, store: storeFor({ [EMAIL.user_A]: sub }), fetchImpl: async () => { throw new Error('socket hang up'); } });
  assert.equal(res.code, 504);
  assert.equal(res.body.error.code, 'provider_uncertain');
  assert.match(res.body.error.message_he, /ייתכן שהביטול לא הושלם/);
  assert.doesNotMatch(res.body.error.message_he, /לא בוטל כלום/);
});

test('token without an email: GET says not online, POST is 409 cannot_cancel_online, no lookup and no provider call', async () => {
  let looked = false; let called = false;
  const store = { async activeSubscription() { looked = true; return sub; } };
  const fetchImpl = async () => { called = true; return { ok: true }; };
  const g = await run({ auth: asUser('user_A'), env, store, fetchImpl }, 'GET');
  assert.equal(g.code, 200);
  assert.deepEqual([g.body.active, g.body.online], [false, false]);
  const p = await run({ auth: asUser('user_A'), env, store, fetchImpl });
  assert.equal(p.code, 409);
  assert.equal(p.body.error.code, 'cannot_cancel_online');
  assert.equal(looked, false);
  assert.equal(called, false);
});

test('an explicitly unverified token email counts as absent', async () => {
  assert.equal(verifiedEmail({ email: 'a@example.com', email_verified: false }), null);
  assert.equal(verifiedEmail({ email: 'a@example.com', email_verified: true }), 'a@example.com');
  assert.equal(verifiedEmail({ email: 'a@example.com' }), 'a@example.com');
  assert.equal(verifiedEmail({ email: 'nope' }), null);
  assert.equal(verifiedEmail({ email: 42 }), null);
  const res = await run({ auth: asUser('user_A', EMAIL.user_A, { email_verified: false }), env, store: storeFor({ [EMAIL.user_A]: sub }) });
  assert.equal(res.code, 409);
});

/** Fake supabase-js query builder that records every table touched. */
function fakeDb({ rows = [], failCreemColumn = false } = {}) {
  const touched = [];
  return {
    touched,
    from(table) {
      touched.push(table);
      let cols = '';
      const b = {
        select(c) { cols = c; return b; },
        eq(_col, val) {
          if (table !== 'subscriptions') return Promise.resolve({ data: [], error: null });
          if (failCreemColumn && cols.includes('creem_subscription_id')) return Promise.resolve({ data: null, error: { code: '42703', message: 'column subscriptions.creem_subscription_id does not exist' } });
          return Promise.resolve({ data: rows.filter((r) => r.user_email === val), error: null });
        },
      };
      return b;
    },
  };
}

test('tampered profile email cannot cancel: the real store never reads profiles, only subscriptions by the token email', async () => {
  // victim has an active subscription under v@example.com; attacker A edited profiles.email to v@example.com
  const db = fakeDb({ rows: [{ user_email: 'v@example.com', plan: 'premium', status: 'active', creem_subscription_id: 'sub_victim' }] });
  let called = false;
  const res = await run({ auth: asUser('user_A', 'a@example.com'), env, store: createSupabaseSubscriptionStore(db), fetchImpl: async () => { called = true; return { ok: true }; } });
  assert.equal(res.code, 404);
  assert.equal(called, false);
  assert.ok(!db.touched.includes('profiles'), `touched: ${db.touched}`);
  assert.deepEqual([...new Set(db.touched)], ['subscriptions']);
});

test('missing creem_subscription_id column: status still works, cancel is 409 cannot_cancel_online (not a 500)', async () => {
  const rows = [{ user_email: 'a@example.com', plan: 'premium', status: 'active' }];
  const store = createSupabaseSubscriptionStore(fakeDb({ rows, failCreemColumn: true }));
  const g = await run({ auth: asUser('user_A', 'a@example.com'), env, store }, 'GET');
  assert.equal(g.body.active, true);
  let called = false;
  const p = await run({ auth: asUser('user_A', 'a@example.com'), env, store, fetchImpl: async () => { called = true; return { ok: true }; } });
  assert.equal(p.code, 409);
  assert.equal(p.body.error.code, 'cannot_cancel_online');
  assert.equal(called, false);
});
