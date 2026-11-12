import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/subscription/cancel.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const asUser = (sub) => async () => ({ ok: true, payload: { sub } });
const noUser = async () => ({ ok: false });
const env = { CREEM_API_KEY: 'ck_test_fake' };
const storeFor = (map) => ({ async activeSubscription(uid) { return map[uid] || null; } });
const run = (over, method = 'POST') => { const res = mkRes(); return handler({ method, headers: {}, body: {} }, res, over).then(() => res); };
const sub = { plan: 'premium', status: 'active', current_period_end: '2026-12-01', creem_subscription_id: 'sub_123' };

test('anonymous is refused', async () => {
  assert.equal((await run({ auth: noUser, env, store: storeFor({}) })).code, 401);
});

test('GET tells whether a paid subscription exists, only for the signed-in user', async () => {
  const store = storeFor({ user_A: sub });
  const a = await run({ auth: asUser('user_A'), env, store }, 'GET');
  assert.equal(a.body.active, true);
  const b = await run({ auth: asUser('user_B'), env, store }, 'GET');
  assert.equal(b.body.active, false);
});

test('POST cancels at Creem with the documented endpoint, header and body; secret never in the answer', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  const res = await run({ auth: asUser('user_A'), env, store: storeFor({ user_A: sub }), fetchImpl });
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
  const res = await run({ auth: asUser('user_B'), env, store: storeFor({ user_A: sub }), fetchImpl });
  assert.equal(res.code, 404);
  assert.equal(called, false);
});

test('provider failure is shown as a Hebrew error and is not reported as success', async () => {
  const res = await run({ auth: asUser('user_A'), env, store: storeFor({ user_A: sub }), fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(res.code, 502);
  assert.match(res.body.error.message_he, /לא בוטל כלום/);
});

test('no API key configured: refuses without calling anyone', async () => {
  let called = false;
  const res = await run({ auth: asUser('user_A'), env: {}, store: storeFor({ user_A: sub }), fetchImpl: async () => { called = true; return { ok: true }; } });
  assert.equal(res.code, 503);
  assert.equal(called, false);
});

test('a subscription row without a Creem id cannot be cancelled online (mailto fallback)', async () => {
  const res = await run({ auth: asUser('user_A'), env, store: storeFor({ user_A: { ...sub, creem_subscription_id: null } }) });
  assert.equal(res.code, 409);
});
