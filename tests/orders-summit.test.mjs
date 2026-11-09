// SUMIT hosted-payment adapter for printed-book orders, end to end against a scriptable fake of Summit.
// Shapes follow Summit's published OpenAPI (https://api.sumit.co.il/swagger/v1/swagger.json, read 9.11.2026):
//   POST /billing/payments/beginredirect/ -> { Status, Data: { RedirectURL } }
//   POST /billing/payments/get/           -> { Status, Data: { Payment: { ID, ValidPayment, Amount, Currency, ExternalIdentifier, DocumentID } } }
//   POST /billing/payments/list/          -> { Status, Data: { Payments: [...], HasNextPage } }
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { endpoint, createPrintPayment } from '../api/_lib/orders/handlers.js';
import { reconcileAwaitingPayments } from '../api/_lib/orders/service.js';
import { createSummitPayment, agorotToUnits } from '../api/_lib/orders/payment/summit.js';
import { ALICE, BOB, GOOD_ADDRESS, call, fakeReq, makeDeps } from './orders-helpers.mjs';

const rnd = () => crypto.randomBytes(12).toString('hex');
const SENV = { SUMIT_COMPANY_ID: '1234567', SUMIT_API_KEY: rnd() };

/** Scriptable fake of Summit. `payments` maps PaymentID -> payment row. */
function fakeSummit({ payments = {}, down = false, beginResponse } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ url: u, body });
    if (down) throw new Error('network down');
    const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
    // every call must carry credentials
    if (!body.Credentials?.APIKey || !body.Credentials?.CompanyID) return json(200, { Status: 1, UserErrorMessage: 'no credentials' });
    if (u.endsWith('/billing/payments/beginredirect/')) {
      return json(200, beginResponse ?? { Status: 0, Data: { RedirectURL: 'https://pay.sumit.test/page/abc' } });
    }
    if (u.endsWith('/billing/payments/get/')) {
      const p = payments[body.PaymentID];
      return p ? json(200, { Status: 0, Data: { Payment: p } }) : json(200, { Status: 1, UserErrorMessage: 'not found' });
    }
    if (u.endsWith('/billing/payments/list/')) {
      return json(200, { Status: 0, Data: { Payments: Object.values(payments), HasNextPage: false } });
    }
    return json(404, {});
  };
  f.calls = calls;
  return f;
}

const payFor = (order, over = {}) => ({
  ID: 900001, ValidPayment: true, Amount: order.total_agorot / 100, Currency: 'ILS',
  ExternalIdentifier: order.id, DocumentID: 777, ...over,
});

async function setup({ payments = {}, opts = {}, env = {} } = {}) {
  const base = makeDeps({ env: { ...SENV, ...env } });
  const fetchImpl = fakeSummit({ payments, ...opts });
  const payment = createSummitPayment({ env: base.env, fetchImpl });
  const deps = { ...base, payment };
  const r = await call(endpoint('create'), fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-summit-' + rnd() },
  }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const order = deps.store._orders.get(r.body.orderId);
  return { deps, fetchImpl, order, created: r.body, payments };
}
const getOrder = (deps, id, paymentId, user = ALICE) =>
  call(endpoint('get'), fakeReq({ user, query: { id, ...(paymentId ? { paymentId: String(paymentId) } : {}) } }), deps);

test('default provider is summit; escape hatches stay explicit', () => {
  assert.equal(createPrintPayment({ ...SENV }).name, 'summit');
  assert.equal(createPrintPayment({ PRINT_PAYMENT_PROVIDER: 'morning' }).name, 'morning');
  assert.equal(createPrintPayment({ PRINT_PAYMENT_PROVIDER: 'creem' }).name, 'creem');
});

test('agorot -> units: 10800 agorot is 108, never 10800', () => {
  assert.equal(agorotToUnits(10800), 108);
  assert.throws(() => agorotToUnits(0));
});

test('checkout request: hosted page, Receipt document, no VAT, order id as ExternalIdentifier, units not agorot', async () => {
  const { fetchImpl, order, created } = await setup();
  assert.equal(created.status, 'awaiting_payment');
  assert.equal(created.checkoutUrl, 'https://pay.sumit.test/page/abc');
  const begin = fetchImpl.calls.find((c) => c.url.endsWith('/beginredirect/')).body;
  assert.equal(begin.DocumentType, 2, 'Receipt, never a tax invoice');
  assert.equal(begin.VATRate, 0);
  assert.equal(begin.ExternalIdentifier, order.id);
  assert.equal(begin.Items[0].UnitPrice * begin.Items[0].Quantity, order.total_agorot / 100);
  assert.equal(begin.Items.length, 1);
  assert.equal(begin.MaximumPayments, 1);
  assert.match(begin.RedirectURL, /paid=1&order=/);
  assert.ok(!/Bookpod|בוקפוד/i.test(JSON.stringify(begin)), 'vendor never named');
});

test('return with a genuine payment id: paid -> submitted, exactly one vendor submission and one receipt ref', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order);
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'submitted');
  assert.equal(s.deps.vendor.calls.length, 1);
  assert.equal(s.deps.store._orders.get(s.order.id).payment_ref, 'summit:900001');
});

test('double return / parallel return: still ONE submission (no double fulfilment)', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order);
  await Promise.all([getOrder(s.deps, s.order.id, 900001), getOrder(s.deps, s.order.id, 900001), getOrder(s.deps, s.order.id, 900001)]);
  await getOrder(s.deps, s.order.id, 900001);
  assert.equal(s.deps.vendor.calls.length, 1);
});

test('FORGED: a real payment that belongs to a DIFFERENT order does not pay this one', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order, { ExternalIdentifier: crypto.randomUUID() });
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.body.status, 'awaiting_payment');
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('FORGED: an invented payment id (Summit does not know it) pays nothing', async () => {
  const s = await setup();
  const r = await getOrder(s.deps, s.order.id, 123456789);
  assert.equal(r.body.status, 'awaiting_payment');
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('payment not valid (declined / cancelled) pays nothing', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order, { ValidPayment: false });
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.body.status, 'awaiting_payment');
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('amount mismatch (paid less) -> failed_needs_attention, nothing submitted', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order, { Amount: 50 });
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.body.status, 'failed_needs_attention');
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('wrong currency pays nothing', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order, { Currency: 'USD' });
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.body.status, 'awaiting_payment');
});

test('Summit unreachable on return: order untouched, no crash, a later poll can still confirm', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order);
  const real = s.deps.payment;
  s.deps.payment = createSummitPayment({ env: s.deps.env, fetchImpl: fakeSummit({ down: true }) });
  const r1 = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.status, 'awaiting_payment');
  s.deps.payment = real;
  const r2 = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r2.body.status, 'submitted');
});

test("someone else's order cannot be confirmed through a return link", async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order);
  const r = await getOrder(s.deps, s.order.id, 900001, BOB);
  assert.equal(r.status, 404);
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('garbage payment ids never reach Summit', async () => {
  const s = await setup();
  const before = s.fetchImpl.calls.length;
  for (const bad of ['abc', '1; drop', '-5', '9'.repeat(30)]) await getOrder(s.deps, s.order.id, bad);
  assert.equal(s.fetchImpl.calls.length, before);
});

test('closed-tab customer: hourly reconcile finds the payment and pays the order once', async () => {
  const s = await setup();
  s.deps.store._orders.get(s.order.id).created_at = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  s.payments[900001] = payFor(s.order);
  const r1 = await reconcileAwaitingPayments(s.deps);
  assert.equal(r1.reconciled, 1);
  assert.equal(s.deps.store._orders.get(s.order.id).status, 'submitted');
  const r2 = await reconcileAwaitingPayments(s.deps);
  assert.equal(r2.reconciled, 0);
  assert.equal(s.deps.vendor.calls.length, 1);
});

test('reconcile ignores a payment whose ExternalIdentifier matches no waiting order', async () => {
  const s = await setup();
  s.deps.store._orders.get(s.order.id).created_at = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  s.payments[900001] = payFor(s.order, { ExternalIdentifier: crypto.randomUUID() });
  const r = await reconcileAwaitingPayments(s.deps);
  assert.equal(r.reconciled, 0);
  assert.equal(s.deps.vendor.calls.length, 0);
});

test('not configured (no company id / key): checkout fails closed with the friendly message, nobody charged', async () => {
  const base = makeDeps({ env: {} });
  const payment = createSummitPayment({ env: base.env, fetchImpl: fakeSummit() });
  const r = await call(endpoint('create'), fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-nc-' + rnd() },
  }), { ...base, payment });
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, 'checkout_failed');
});

test('Summit rejects the page request: friendly 502, no checkout url stored', async () => {
  const base = makeDeps({ env: SENV });
  const payment = createSummitPayment({ env: base.env, fetchImpl: fakeSummit({ beginResponse: { Status: 1, UserErrorMessage: 'x' } }) });
  const r = await call(endpoint('create'), fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-rej-' + rnd() },
  }), { ...base, payment });
  assert.equal(r.status, 502);
});

test('the API key never appears in any response body', async () => {
  const s = await setup();
  s.payments[900001] = payFor(s.order);
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.ok(!JSON.stringify(r.body).includes(SENV.SUMIT_API_KEY));
  assert.ok(!JSON.stringify(s.created).includes(SENV.SUMIT_API_KEY));
});

test('flag off: the return endpoint does nothing at all (404, no Summit call)', async () => {
  const s = await setup();
  s.deps.env = { ...s.deps.env, PRINT_ORDER_ENABLED: 'false' };
  const before = s.fetchImpl.calls.length;
  const r = await getOrder(s.deps, s.order.id, 900001);
  assert.equal(r.status, 404);
  assert.equal(s.fetchImpl.calls.length, before);
});
