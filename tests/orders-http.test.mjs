import test from 'node:test';
import assert from 'node:assert/strict';
import { endpoint } from '../api/_lib/orders/handlers.js';
import { watchHandler } from '../api/_lib/orders/cron.js';
import { handlePaymentEvent } from '../api/_lib/orders/service.js';
import { normalizeCreemEvent } from '../api/_lib/orders/payment/creem.js';
import { VendorError } from '../api/_lib/bookpod/client.js';
import {
  ALICE, BOB, ADMIN, GOOD_ADDRESS, CRON_TOKEN, call, fakeReq, makeDeps, seen,
} from './orders-helpers.mjs';

const NAMES = ['config', 'quote', 'create', 'mine', 'get', 'admin-list', 'admin-action'];
const H = Object.fromEntries(NAMES.map((n) => [n, endpoint(n)]));
const METHOD = { quote: 'GET', create: 'POST', mine: 'GET', get: 'GET', 'admin-list': 'GET', 'admin-action': 'POST' };

async function placeOrder(deps, user = ALICE, bookId = 'book-alice', key = 'key-http-0001') {
  const r = await call(H.create, fakeReq({
    method: 'POST', user, body: { bookId, qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: key },
  }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.orderId;
}

test('FLAG OFF: every endpoint is 404 "disabled", config says enabled:false, and ZERO fetch calls happen', async () => {
  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('network must not be used while the flag is off'); };
  try {
    for (const env of [{}, { PRINT_ORDER_ENABLED: 'false' }, { PRINT_ORDER_ENABLED: '1' }, { PRINT_ORDER_ENABLED: 'TRUE' }]) {
      for (const name of NAMES.filter((n) => n !== 'config')) {
        const r = await call(H[name], fakeReq({ method: METHOD[name], user: ALICE, body: {}, query: { bookId: 'book-alice', qty: '1', method: 'ship' } }), { env });
        assert.equal(r.status, 404, `${name} with ${JSON.stringify(env)}`);
        assert.equal(r.body.error.code, 'disabled');
      }
      const cfg = await call(H.config, fakeReq({ method: 'GET' }), { env });
      assert.deepEqual([cfg.status, cfg.body], [200, { enabled: false }]);
    }
    // the cron endpoint and the payment webhook routing obey the same flag
    const cron = await call(watchHandler(), fakeReq({ method: 'GET', headers: { authorization: `Bearer ${CRON_TOKEN}` } }), { env: { CRON_SECRET: CRON_TOKEN } });
    assert.equal(cron.status, 404);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(fetchCalls, 0);
});

test('CONTROL: with the flag ON the same call is NOT 404 (the flag test can fail)', async () => {
  const deps = makeDeps();
  const r = await call(H.mine, fakeReq({ method: 'GET', user: ALICE }), deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { orders: [] });
  const cfg = await call(H.config, fakeReq({ method: 'GET' }), deps);
  assert.deepEqual(cfg.body, { enabled: true, pickup: { enabled: false, label_he: 'איסוף עצמי' }, maxQty: 10 });
});

test('auth: no/invalid token -> 401 on every authenticated endpoint', async () => {
  const deps = makeDeps();
  for (const name of NAMES.filter((n) => n !== 'config')) {
    const r = await call(H[name], fakeReq({ method: METHOD[name], body: {} }), deps);
    assert.equal(r.status, 401, name);
    assert.equal(r.body.error.code, 'unauthorized');
  }
});

test('wrong HTTP method -> 405', async () => {
  const deps = makeDeps();
  const r = await call(H.create, fakeReq({ method: 'GET', user: ALICE }), deps);
  assert.equal(r.status, 405);
});

test('quote: exact numbers over HTTP, ownership enforced', async () => {
  const deps = makeDeps();
  const ok = await call(H.quote, fakeReq({ method: 'GET', user: ALICE, query: { bookId: 'book-alice', qty: '2', method: 'ship' } }), deps);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.totalAgorot, 18700); // 2 x 79.00 + 29.00
  assert.equal(ok.body.vatIncluded, true);
  const foreign = await call(H.quote, fakeReq({ method: 'GET', user: ALICE, query: { bookId: 'book-bob', qty: '1', method: 'ship' } }), deps);
  assert.equal(foreign.status, 404);
  const sizes = await call(H.quote, fakeReq({ method: 'GET', user: ALICE, query: { bookId: 'book-alice-200', qty: '1', method: 'ship' } }), deps);
  assert.equal(sizes.body.error.code, 'size_not_available');
  const badQty = await call(H.quote, fakeReq({ method: 'GET', user: ALICE, query: { bookId: 'book-alice', qty: 'x', method: 'ship' } }), deps);
  assert.equal(badQty.body.error.code, 'invalid_qty');
});

test('a user cannot read another user\'s order; sees only their own list', async () => {
  const deps = makeDeps();
  const aliceOrder = await placeOrder(deps, ALICE, 'book-alice', 'key-alice-001');
  const bobOrder = await placeOrder(deps, BOB, 'book-bob', 'key-bob-00001');
  const own = await call(H.get, fakeReq({ method: 'GET', user: ALICE, query: { id: aliceOrder } }), deps);
  assert.equal(own.status, 200);
  assert.equal(own.body.id, aliceOrder);
  assert.equal(own.body.bookTitle, 'הדרקון של נועה');
  assert.equal(own.body.statusLabel_he, 'ממתין לתשלום');
  const peek = await call(H.get, fakeReq({ method: 'GET', user: ALICE, query: { id: bobOrder } }), deps);
  assert.equal(peek.status, 404);
  const peekAdmin = await call(H.get, fakeReq({ method: 'GET', user: ADMIN, query: { id: bobOrder } }), deps);
  assert.equal(peekAdmin.status, 404, 'even the admin id is not an owner');
  const missing = await call(H.get, fakeReq({ method: 'GET', user: ALICE, query: { id: '22222222-2222-4222-8222-222222222222' } }), deps);
  assert.deepEqual(missing.body, peek.body, 'foreign and missing are indistinguishable');
  const notUuid = await call(H.get, fakeReq({ method: 'GET', user: ALICE, query: { id: "x' or 1=1" } }), deps);
  assert.equal(notUuid.status, 404);
  const list = await call(H.mine, fakeReq({ method: 'GET', user: ALICE }), deps);
  assert.deepEqual(list.body.orders.map((o) => o.id), [aliceOrder]);
  // the user view never carries internals
  assert.deepEqual(Object.keys(own.body).sort(),
    ['bookId', 'bookTitle', 'createdAt', 'id', 'method', 'presetId', 'qty', 'status', 'statusLabel_he', 'totalAgorot']);
});

test('ADMIN: non-admin 403, admin 200; env missing -> everybody 403 (fail closed)', async () => {
  const deps = makeDeps();
  await placeOrder(deps);
  for (const [name, method, body] of [['admin-list', 'GET'], ['admin-action', 'POST', { id: 'x', action: 'cancel' }]]) {
    const r = await call(H[name], fakeReq({ method, user: ALICE, body }), deps);
    assert.equal(r.status, 403, name);
  }
  const ok = await call(H['admin-list'], fakeReq({ method: 'GET', user: ADMIN }), deps);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.orders.length, 1);
  assert.equal(ok.body.orders[0].userId, ALICE);
  const filtered = await call(H['admin-list'], fakeReq({ method: 'GET', user: ADMIN, query: { status: 'paid' } }), deps);
  assert.equal(filtered.body.orders.length, 0);

  for (const missing of [{ PRINT_ADMIN_CLERK_IDS: '' }, { PRINT_ADMIN_CLERK_IDS: ' , ,' }]) {
    const d = makeDeps({ env: missing });
    const r = await call(H['admin-list'], fakeReq({ method: 'GET', user: ADMIN }), d);
    assert.equal(r.status, 403);
  }
  const noVar = makeDeps();
  delete noVar.env.PRINT_ADMIN_CLERK_IDS;
  assert.equal((await call(H['admin-list'], fakeReq({ method: 'GET', user: ADMIN }), noVar)).status, 403);
  assert.equal((await call(H['admin-list'], fakeReq({ method: 'GET', user: '' }), noVar)).status, 401);
});

test('admin-action over HTTP: cancel works, bad id/action are 400, unknown order 404', async () => {
  const deps = makeDeps();
  const id = await placeOrder(deps);
  const bad = await call(H['admin-action'], fakeReq({ method: 'POST', user: ADMIN, body: { id: 'nope', action: 'cancel' } }), deps);
  assert.equal(bad.status, 400);
  const unk = await call(H['admin-action'], fakeReq({ method: 'POST', user: ADMIN, body: { id: '33333333-3333-4333-8333-333333333333', action: 'cancel' } }), deps);
  assert.equal(unk.status, 404);
  const act = await call(H['admin-action'], fakeReq({ method: 'POST', user: ADMIN, body: { id, action: 'explode' } }), deps);
  assert.equal(act.body.error.code, 'invalid_action');
  const ok = await call(H['admin-action'], fakeReq({ method: 'POST', user: ADMIN, body: { id, action: 'cancel', note: 'customer asked' } }), deps);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.order.status, 'cancelled');
  const again = await call(H['admin-action'], fakeReq({ method: 'POST', user: ADMIN, body: { id, action: 'cancel' } }), deps);
  assert.equal(again.status, 409);
});

test('admin sees failures and alerts, but vendor identity in error text is scrubbed', async () => {
  const deps = makeDeps();
  deps.vendor = {
    calls: [],
    async submitOrder() { throw new VendorError('vendor_rejected', 'BookPod says: invalid cover, בוקפוד'); },
  };
  const id = await placeOrder(deps);
  const evt = normalizeCreemEvent(deps.payment.buildCompletedEvent(deps.store._orders.get(id)).event);
  await handlePaymentEvent(deps, evt);
  const r = await call(H['admin-list'], fakeReq({ method: 'GET', user: ADMIN }), deps);
  assert.equal(r.body.orders[0].status, 'failed_needs_attention');
  assert.match(r.body.orders[0].lastError, /^rejected:/);
  assert.ok(r.body.alerts.length >= 1);
  assert.doesNotMatch(JSON.stringify(r.body), /bookpod|בוקפוד/i);
});

test('CRON endpoint: bearer secret required, missing CRON_SECRET fails closed', async () => {
  const deps = makeDeps();
  const h = watchHandler();
  assert.equal((await call(h, fakeReq({ method: 'GET' }), deps)).status, 401);
  assert.equal((await call(h, fakeReq({ method: 'GET', headers: { authorization: 'Bearer wrong' } }), deps)).status, 401);
  const ok = await call(h, fakeReq({ method: 'GET', headers: { authorization: `Bearer ${CRON_TOKEN}` } }), deps);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { checked: 0, newAlerts: 0, delivery: 'not_configured', swept: 0 });
  const noSecret = makeDeps();
  delete noSecret.env.CRON_SECRET;
  // even sending "Bearer undefined" or an empty bearer must not get in
  for (const authz of ['Bearer undefined', 'Bearer ', '']) {
    assert.equal((await call(h, fakeReq({ method: 'GET', headers: { authorization: authz } }), noSecret)).status, 401);
  }
});

test('NO VENDOR NAME in any response body returned during this file', () => {
  assert.ok(seen.length > 25, `expected many recorded responses, got ${seen.length}`);
  const leaks = seen.filter((s) => /bookpod|book\s*pod|בוקפוד/i.test(s));
  assert.deepEqual(leaks, []);
});

test('CONTROL: the vendor-name scan can fail (it flags a planted leak)', () => {
  const planted = [...seen, JSON.stringify({ error: { message_he: 'BookPod is down' } })];
  assert.equal(planted.filter((s) => /bookpod|book\s*pod|בוקפוד/i.test(s)).length, 1);
});
