// Morning (Green Invoice) adapter + webhook for printed-book orders.
// Fake Morning uses the response shapes from Morning's published OpenAPI (developers.morning.co, 8.11.2026):
//   POST /payments/form -> { success, errorCode, url } ; GET /documents/{id} -> Document ; POST /documents/search -> { items }
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { endpoint } from '../api/_lib/orders/handlers.js';
import { handleMorningWebhook } from '../api/webhooks/morning.js';
import {
  createMorningPayment, agorotToUnits, notifyToken, morningApiBase, PaymentError,
} from '../api/_lib/orders/payment/morning.js';
import { ALICE, GOOD_ADDRESS, call, fakeReq, fakeRes, makeDeps, webhookReq } from './orders-helpers.mjs';

const rnd = () => crypto.randomBytes(12).toString('hex');
const MENV = { MORNING_API_KEY_ID: rnd(), MORNING_API_KEY_SECRET: rnd(), MORNING_NOTIFY_SECRET: rnd() };

/** Scriptable fake of Morning's API. */
function fakeMorning({ docs = [], formResponse, down = false } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method: init.method, body, auth: init.headers?.Authorization });
    if (down) throw new Error('network down');
    const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (u.endsWith('/idp/v1/oauth/token')) return json(200, { accessToken: 'tok_' + rnd(), expiresIn: 3600 });
    if (u.endsWith('/payments/form')) {
      return json(201, formResponse ?? { success: true, errorCode: 0, url: 'https://pay.morning.test/form/abc' });
    }
    if (u.endsWith('/documents/search')) return json(200, { total: docs.length, page: 1, pageSize: 25, items: docs.map((d) => ({ id: d.id })) });
    const m = /\/documents\/([^/]+)$/.exec(u);
    if (m) {
      const d = docs.find((x) => x.id === m[1]);
      return d ? json(200, d) : json(404, { errorCode: 404 });
    }
    return json(404, {});
  };
  f.calls = calls;
  return f;
}

const receiptFor = (order, over = {}) => ({
  id: 'doc-' + rnd(), number: 40123, type: 400, status: 1, currency: 'ILS',
  amount: order.total_agorot / 100, remarks: `הזמנה ${order.id}`, ...over,
});

async function setup({ docs = [], morningOpts = {}, env = {} } = {}) {
  const fetchImpl = fakeMorning({ docs, ...morningOpts });
  const base = makeDeps({ env: { ...MENV, ...env } });
  const payment = createMorningPayment({ env: base.env, fetchImpl });
  const deps = { ...base, payment };
  const r = await call(endpoint('create'), fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-morning-' + rnd() },
  }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const order = deps.store._orders.get(r.body.orderId);
  return { deps, fetchImpl, order, created: r.body };
}

function notifyReq(order, { token, raw = '{}', headers = {}, secret = MENV.MORNING_NOTIFY_SECRET } = {}) {
  const req = webhookReq(raw, headers);
  req.query = { o: order.id, t: token ?? notifyToken(order.id, secret) };
  return req;
}
async function notify(deps, req) {
  const res = fakeRes();
  await handleMorningWebhook(req, res, deps);
  return { status: res.statusCode, body: res.body };
}

test('amount: 10800 agorot is sent as 108 ILS (units), never 10800', async () => {
  assert.equal(agorotToUnits(10800), 108);
  assert.equal(agorotToUnits(10850), 108.5);
  assert.throws(() => agorotToUnits(0), (e) => e.code === 'bad_amount');
  assert.throws(() => agorotToUnits(108.5), (e) => e.code === 'bad_amount');
  const { fetchImpl, order, created } = await setup();
  const form = fetchImpl.calls.find((c) => c.url.endsWith('/payments/form'));
  assert.equal(form.body.amount, order.total_agorot / 100);
  assert.equal(form.body.income[0].price, form.body.amount);
  assert.ok(form.body.amount < 1000, 'units, not agorot');
  assert.equal(form.body.currency, 'ILS');
  assert.equal(form.body.type, 400, 'receipt, osek patur');
  assert.equal(form.body.vatType, 1, 'exempt');
  assert.equal(form.body.custom, order.id);
  assert.ok(form.auth.startsWith('Bearer tok_'));
  assert.equal(created.checkoutUrl, 'https://pay.morning.test/form/abc');
  assert.ok(form.body.notifyUrl.startsWith('https://sipurai.ai/api/webhooks/morning?o=' + order.id));
  assert.ok(!JSON.stringify(form.body).toLowerCase().includes('creem'));
  assert.ok(!JSON.stringify(form.body).toLowerCase().includes('bookpod'));
});

test('checkout: failure shapes fail closed with a Hebrew-safe error', async () => {
  for (const [name, opts] of [
    ['success:false', { formResponse: { success: false, errorCode: 1234 } }],
    ['http url', { formResponse: { success: true, url: 'http://insecure.test' } }],
    ['unreachable', { down: true }],
  ]) {
    const base = makeDeps({ env: MENV });
    const payment = createMorningPayment({ env: base.env, fetchImpl: fakeMorning(opts) });
    const r = await call(endpoint('create'), fakeReq({
      method: 'POST', user: ALICE,
      body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-fail-' + rnd() },
    }), { ...base, payment });
    assert.equal(r.status, 502, name);
    assert.equal(r.body.error.code, 'checkout_failed', name);
  }
  const p = createMorningPayment({ env: {}, fetchImpl: fakeMorning() });
  await assert.rejects(p.createCheckout({ id: 'x', total_agorot: 100 }), (e) => e instanceof PaymentError && e.code === 'payment_not_configured');
  assert.equal(morningApiBase({}), 'https://api.greeninvoice.co.il/api/v1');
  assert.equal(morningApiBase({ MORNING_TEST_MODE: 'true' }), 'https://sandbox.d.greeninvoice.co.il/api/v1');
});

test('notify with valid token + matching receipt -> paid exactly once, receipt number stored, duplicate harmless', async () => {
  const { deps, order, fetchImpl } = await setup();
  const doc = receiptFor(order);
  const f2 = fakeMorning({ docs: [doc] });
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: f2 });

  const r1 = await notify(deps, notifyReq(order, { raw: JSON.stringify({ documentId: doc.id }) }));
  assert.equal(r1.status, 200);
  const after = deps.store._orders.get(order.id);
  assert.notEqual(after.status, 'awaiting_payment');
  assert.equal(after.payment_ref, doc.id);
  assert.ok(after.paid_at);
  const paid = deps.store._events.filter((e) => e.order_id === order.id && e.type === 'paid');
  assert.equal(paid.length, 1);
  assert.equal(paid[0].data.receiptNumber, 40123);
  const attemptsBefore = after.vendor_submit_attempts;
  const r2 = await notify(deps, notifyReq(order, { raw: JSON.stringify({ documentId: doc.id }) }));
  assert.equal(r2.status, 200);
  assert.equal(deps.store._orders.get(order.id).vendor_submit_attempts, attemptsBefore, 'second delivery does not submit again');
  void fetchImpl;
});

test('notify without a documentId finds the receipt by searching, and matches on THIS order only', async () => {
  const { deps, order } = await setup();
  const other = { ...order, id: crypto.randomUUID() };
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: fakeMorning({ docs: [receiptFor(other), receiptFor(order)] }) });
  const r = await notify(deps, notifyReq(order));
  assert.equal(r.status, 200);
  assert.notEqual(deps.store._orders.get(order.id).status, 'awaiting_payment');
});

test('bad / missing / foreign token -> 401 and the order is untouched, Morning is never asked', async () => {
  const { deps, order } = await setup();
  const f2 = fakeMorning({ docs: [receiptFor(order)] });
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: f2 });
  for (const token of ['deadbeef', '', notifyToken(order.id, 'another-secret'), notifyToken(crypto.randomUUID(), MENV.MORNING_NOTIFY_SECRET)]) {
    const r = await notify(deps, notifyReq(order, { token: token || undefined, ...(token === '' ? { token: '' } : {}) }));
    assert.equal(r.status, 401, `token "${token.slice(0, 8)}"`);
  }
  assert.equal(deps.store._orders.get(order.id).status, 'awaiting_payment');
  assert.equal(f2.calls.length, 0);
});

test('no valid receipt -> 202, order stays awaiting_payment (a notify alone never marks paid)', async () => {
  const { deps, order } = await setup();
  const bad = [
    receiptFor(order, { amount: 79 }),                       // wrong amount is handled below; here: wrong type
    receiptFor(order, { type: 320 }),                        // not a receipt
    receiptFor(order, { currency: 'USD' }),
    receiptFor(order, { status: 4 }),                        // cancelled
    receiptFor(order, { remarks: 'הזמנה אחרת' }),            // another order
  ].map((d, i) => (i === 0 ? { ...d, type: 400, remarks: 'x' } : d));
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: fakeMorning({ docs: bad }) });
  const r = await notify(deps, notifyReq(order));
  assert.equal(r.status, 202);
  assert.equal(deps.store._orders.get(order.id).status, 'awaiting_payment');
});

test('receipt with the wrong amount -> failed_needs_attention, never fulfilled', async () => {
  const { deps, order } = await setup();
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: fakeMorning({ docs: [receiptFor(order, { amount: 79 })] }) });
  const r = await notify(deps, notifyReq(order));
  assert.equal(r.status, 200);
  assert.equal(deps.store._orders.get(order.id).status, 'failed_needs_attention');
  assert.equal(deps.store._orders.get(order.id).vendor_submit_attempts || 0, 0);
});

test('Morning unreachable while confirming -> 503 (Morning retries), order untouched', async () => {
  const { deps, order } = await setup();
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: fakeMorning({ down: true }) });
  const r = await notify(deps, notifyReq(order));
  assert.equal(r.status, 503);
  assert.equal(deps.store._orders.get(order.id).status, 'awaiting_payment');
});

test('optional x-webhook-signature: wrong one -> 401, right one -> accepted', async () => {
  const secret = rnd();
  const { deps, order } = await setup({ env: { MORNING_WEBHOOK_SECRET: secret } });
  deps.payment = createMorningPayment({ env: deps.env, fetchImpl: fakeMorning({ docs: [receiptFor(order)] }) });
  const raw = '{"x":1}';
  const wrong = await notify(deps, notifyReq(order, { raw, headers: { 'x-webhook-signature': 'aa'.repeat(32) } }));
  assert.equal(wrong.status, 401);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const ok = await notify(deps, notifyReq(order, { raw, headers: { 'x-webhook-signature': sig } }));
  assert.equal(ok.status, 200);
});

test('flag off -> 404 before any I/O; GET -> 405; missing notify secret -> 500', async () => {
  const { deps, order } = await setup();
  const f2 = fakeMorning({ docs: [receiptFor(order)] });
  const off = { ...deps, env: { ...deps.env, PRINT_ORDER_ENABLED: 'false' }, payment: createMorningPayment({ env: deps.env, fetchImpl: f2 }) };
  assert.equal((await notify(off, notifyReq(order))).status, 404);
  assert.equal(f2.calls.length, 0);
  const res = fakeRes();
  await handleMorningWebhook({ method: 'GET', headers: {} }, res, deps);
  assert.equal(res.statusCode, 405);
  const noSecret = { ...deps, env: { ...deps.env, MORNING_NOTIFY_SECRET: '' } };
  noSecret.payment = createMorningPayment({ env: noSecret.env, fetchImpl: f2 });
  assert.equal((await notify(noSecret, notifyReq(order))).status, 500);
});

test('default provider for print orders is Morning, not Creem', async () => {
  const { createPrintPayment } = await import('../api/_lib/orders/handlers.js');
  assert.equal(createPrintPayment({}).name, 'morning');
  assert.equal(createPrintPayment({ PRINT_PAYMENT_PROVIDER: 'creem' }).name, 'creem');
});
