// Drives the REAL api/webhooks/creem.js handler (signature check included) with injected order deps.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { endpoint } from '../api/_lib/orders/handlers.js';
import {
  ALICE, GOOD_ADDRESS, MOCK_SECRET, call, fakeReq, fakeRes, makeDeps, webhookReq,
} from './orders-helpers.mjs';

let handleCreemWebhook;
let subscriptionWrites;
const realFetch = globalThis.fetch;

before(async () => {
  // creem.js builds its Supabase client at import time: give it a dummy, unroutable project.
  process.env.CREEM_WEBHOOK_SECRET = MOCK_SECRET;
  process.env.SUPABASE_URL = 'https://dummy-project.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = crypto.randomBytes(16).toString('hex');
  subscriptionWrites = [];
  globalThis.fetch = async (url, init) => {
    subscriptionWrites.push({ url: String(url), method: init?.method, body: init?.body });
    return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
  };
  ({ handleCreemWebhook } = await import('../api/webhooks/creem.js'));
});
after(() => { globalThis.fetch = realFetch; });

const sign = (raw, secret = MOCK_SECRET) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

async function deliver(raw, headers, deps) {
  const res = fakeRes();
  await handleCreemWebhook(webhookReq(raw, headers), res, deps);
  return { status: res.statusCode, body: res.body };
}

async function orderFixture(deps) {
  const r = await call(endpoint('create'), fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-hook-0001' },
  }), deps);
  return r.body.orderId;
}
const order = (deps, id) => deps.store._orders.get(id);

test('signed checkout.completed for a print order -> paid + exactly one submission, even if Creem delivers it twice', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const { raw, headers } = deps.payment.buildCompletedEvent(order(deps, id), { eventId: 'evt_w1' });
  const first = await deliver(raw, headers, deps);
  const second = await deliver(raw, headers, deps);
  assert.deepEqual([first.status, second.status], [200, 200]);
  assert.equal(order(deps, id).status, 'submitted');
  assert.equal(deps.vendor.calls.length, 1);
  assert.equal(deps.store._events.filter((e) => e.type === 'paid').length, 1);
  assert.equal(order(deps, id).payment_ref, `mock_co_${id}`);
});

test('two different signed events for one order -> one submission', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const a = deps.payment.buildCompletedEvent(order(deps, id), { eventId: 'evt_a', checkoutId: 'co_a' });
  const b = deps.payment.buildCompletedEvent(order(deps, id), { eventId: 'evt_b', checkoutId: 'co_b' });
  await Promise.all([deliver(a.raw, a.headers, deps), deliver(b.raw, b.headers, deps)]);
  assert.equal(deps.vendor.calls.length, 1);
  assert.equal(deps.store._events.filter((e) => e.type === 'paid').length, 1);
});

test('BAD SIGNATURE -> 401 and the order is untouched; missing signature -> 401; wrong secret -> 401', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const { raw } = deps.payment.buildCompletedEvent(order(deps, id));
  for (const headers of [{ 'x-creem-signature': 'deadbeef' }, { 'x-creem-signature': sign(raw, 'another-secret') }, {}]) {
    const r = await deliver(raw, headers, deps);
    assert.equal(r.status, 401, JSON.stringify(headers));
  }
  // tampered body with a signature of the original
  const good = deps.payment.buildCompletedEvent(order(deps, id));
  const tampered = good.raw.replace('"paid"', '"paid" ');
  assert.equal((await deliver(tampered, good.headers, deps)).status, 401);
  assert.equal(order(deps, id).status, 'awaiting_payment');
  assert.equal(deps.vendor.calls.length, 0);
});

test('CONTROL: the same body with the right signature does change the order', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const { raw, headers } = deps.payment.buildCompletedEvent(order(deps, id));
  assert.equal((await deliver(raw, headers, deps)).status, 200);
  assert.equal(order(deps, id).status, 'submitted');
});

test('amount mismatch through the webhook -> failed_needs_attention, nothing submitted', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const { raw, headers } = deps.payment.buildCompletedEvent(order(deps, id), { amountAgorot: 100 });
  assert.equal((await deliver(raw, headers, deps)).status, 200);
  assert.equal(order(deps, id).status, 'failed_needs_attention');
  assert.equal(deps.vendor.calls.length, 0);
  assert.ok(deps.store._events.some((e) => e.type === 'alert_amount_mismatch'));
});

test('flag OFF: a signed order event is acknowledged but changes nothing', async () => {
  const deps = makeDeps();
  const id = await orderFixture(deps);
  const off = { ...deps, env: { ...deps.env, PRINT_ORDER_ENABLED: 'false' } };
  const { raw, headers } = deps.payment.buildCompletedEvent(order(deps, id));
  assert.equal((await deliver(raw, headers, off)).status, 200);
  assert.equal(order(deps, id).status, 'awaiting_payment');
  assert.equal(deps.vendor.calls.length, 0);
});

test('REGRESSION: subscription events still hit the subscriptions table exactly as before', async () => {
  subscriptionWrites.length = 0;
  const raw = JSON.stringify({
    type: 'subscription.created',
    data: { id: 'sub_1', status: 'active', customer: { id: 'cus_1', email: 'parent@example.test' }, product: { id: 'prod_2pdZoAylJ4858chxMtzspo' } },
  });
  const r = await deliver(raw, { 'x-creem-signature': sign(raw) }, makeDeps());
  assert.deepEqual([r.status, r.body], [200, { received: true }]);
  const w = subscriptionWrites.find((x) => x.url.includes('/rest/v1/subscriptions'));
  assert.ok(w, `expected a subscriptions write, saw: ${subscriptionWrites.map((x) => x.url).join(', ')}`);
  assert.equal(w.method, 'POST');
  const sent = JSON.parse(w.body);
  const row = Array.isArray(sent) ? sent[0] : sent;
  assert.equal(row.user_email, 'parent@example.test');
  assert.equal(row.plan, 'premium');
  assert.equal(row.status, 'active');
});

test('REGRESSION: subscription path keeps its guards (bad signature 401, bad JSON 400, GET 405, missing secret 500)', async () => {
  const raw = JSON.stringify({ type: 'subscription.created', data: { customer: { email: 'a@b.test' } } });
  subscriptionWrites.length = 0;
  assert.equal((await deliver(raw, { 'x-creem-signature': 'aa' }, makeDeps())).status, 401);
  assert.equal((await deliver(raw, {}, makeDeps())).status, 401);
  assert.equal((await deliver('{not json', { 'x-creem-signature': sign('{not json') }, makeDeps())).status, 400);
  assert.equal(subscriptionWrites.length, 0, 'rejected requests must not write');
  const res = fakeRes();
  await handleCreemWebhook({ method: 'GET', headers: {} }, res, makeDeps());
  assert.equal(res.statusCode, 405);
  const saved = process.env.CREEM_WEBHOOK_SECRET;
  delete process.env.CREEM_WEBHOOK_SECRET;
  try {
    assert.equal((await deliver(raw, { 'x-creem-signature': sign(raw) }, makeDeps())).status, 500);
  } finally {
    process.env.CREEM_WEBHOOK_SECRET = saved;
  }
});

test('a checkout.completed WITHOUT one of our order ids falls through to the old behaviour (ack, no order work)', async () => {
  const deps = makeDeps();
  const raw = JSON.stringify({ id: 'evt_x', eventType: 'checkout.completed', object: { id: 'co_sub', metadata: {} } });
  const r = await deliver(raw, { 'x-creem-signature': sign(raw) }, deps);
  assert.equal(r.status, 200);
  assert.equal(deps.store._orders.size, 0);
});
