import test from 'node:test';
import assert from 'node:assert/strict';
import { endpoint } from '../api/_lib/orders/handlers.js';
import { handlePaymentEvent, submitOrder, adminAction, runStuckWatch, OrderError } from '../api/_lib/orders/service.js';
import { normalizeCreemEvent } from '../api/_lib/orders/payment/creem.js';
import { ALICE, BOB, ADMIN, GOOD_ADDRESS, call, fakeReq, makeDeps } from './orders-helpers.mjs';

const create = endpoint('create');

async function newOrder(deps, over = {}) {
  const r = await call(create, fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-0001-aaaa', ...over },
  }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const paidEvent = (deps, orderId, opts) => {
  const row = deps.store._orders.get(orderId);
  return normalizeCreemEvent(deps.payment.buildCompletedEvent(row, opts).event);
};
const count = (deps, orderId, type) => deps.store._events.filter((e) => e.order_id === orderId && e.type === type).length;

test('create: stores a price snapshot, opens checkout, returns the checkout url', async () => {
  const deps = makeDeps();
  const out = await newOrder(deps);
  assert.equal(out.status, 'awaiting_payment');
  assert.match(out.checkoutUrl, /^https:\/\/pay\.mock\.test\/checkout\//);
  const row = deps.store._orders.get(out.orderId);
  assert.equal(row.total_agorot, 10800);
  assert.equal(row.quote.priceVersion, '2026-11-08.v1');
  assert.equal(row.quote.bookTitle, 'הדרקון של נועה');
  assert.equal(row.preset_id, 'square-220');
  assert.equal(deps.payment.checkouts.length, 1);
});

test('create is idempotent: same key + user -> same order, one row, one checkout', async () => {
  const deps = makeDeps();
  const a = await newOrder(deps);
  const b = await newOrder(deps);
  const c = await newOrder(deps, { qty: 3 }); // even with different params the key wins
  assert.equal(a.orderId, b.orderId);
  assert.equal(a.orderId, c.orderId);
  assert.equal(deps.store._orders.size, 1);
  assert.equal(deps.payment.checkouts.length, 1);
  assert.equal(b.checkoutUrl, a.checkoutUrl);
  // a different user may reuse the same key string and gets their own order
  const bob = await call(create, fakeReq({
    method: 'POST', user: BOB,
    body: { bookId: 'book-bob', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-0001-aaaa' },
  }), deps);
  assert.notEqual(bob.body.orderId, a.orderId);
  assert.equal(deps.store._orders.size, 2);
});

test('create: concurrent identical requests still produce one order', async () => {
  const deps = makeDeps();
  const reqs = Array.from({ length: 5 }, () => newOrder(deps));
  const ids = new Set((await Promise.all(reqs)).map((r) => r.orderId));
  assert.equal(ids.size, 1);
  assert.equal(deps.store._orders.size, 1);
});

test('create: Israeli address validation (ship needs street+house, bad phone/zip rejected)', async () => {
  const deps = makeDeps();
  const bad = await call(create, fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', idempotencyKey: 'key-bad-0001',
      address: { fullName: 'ד', phone: '12345', city: 'חיפה', street: '', houseNumber: 'abc', zip: '12' } },
  }), deps);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_address');
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['fullName', 'houseNumber', 'phone', 'street', 'zip']);
  assert.equal(deps.store._orders.size, 0);
  for (const phone of ['050-1234567', '0501234567', '+972501234567', '+972-50-1234567']) {
    const r = await call(create, fakeReq({
      method: 'POST', user: ALICE,
      body: { bookId: 'book-alice', qty: 1, method: 'ship', idempotencyKey: `key-ph-${phone.replace(/\D/g, '')}`,
        address: { ...GOOD_ADDRESS, phone, zip: '1234567', houseNumber: '12א' } },
    }), deps);
    assert.equal(r.status, 200, phone);
  }
  assert.ok([...deps.store._orders.values()].every((o) => o.address.phone === '050-1234567'));
});

test('create: unverified size is refused with size_not_available', async () => {
  const deps = makeDeps();
  const r = await call(create, fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice-200', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-size-0001' },
  }), deps);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'size_not_available');
  assert.equal(deps.store._orders.size, 0);
});

test('create: cannot order a book that belongs to someone else', async () => {
  const deps = makeDeps();
  const r = await call(create, fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-bob', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-own-00001' },
  }), deps);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'book_not_found');
  assert.equal(deps.store._orders.size, 0);
});

test('WEBHOOK DOUBLE DELIVERY: same event twice (concurrently) -> one transition, one submission', async () => {
  const deps = makeDeps();
  const { orderId } = await newOrder(deps);
  const evt = paidEvent(deps, orderId, { eventId: 'evt_same' });
  const results = await Promise.all([handlePaymentEvent(deps, evt), handlePaymentEvent(deps, evt)]);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ['duplicate', 'paid']);
  assert.equal(count(deps, orderId, 'paid'), 1, 'exactly one paid transition');
  assert.equal(deps.vendor.calls.length, 1, 'exactly one fulfillment submission');
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'submitted');
  assert.equal(row.vendor_ref, 'mock-ref-1');
  assert.equal(row.vendor_submit_attempts, 1);
  // and sequentially, a third delivery later
  assert.equal((await handlePaymentEvent(deps, evt)).outcome, 'duplicate');
  assert.equal(deps.vendor.calls.length, 1);
});

test('WEBHOOK: two DIFFERENT events for one order -> still one transition, one submission', async () => {
  const deps = makeDeps();
  const { orderId } = await newOrder(deps);
  const e1 = paidEvent(deps, orderId, { eventId: 'evt_one', checkoutId: 'co_one' });
  const e2 = paidEvent(deps, orderId, { eventId: 'evt_two', checkoutId: 'co_two' });
  await Promise.all([handlePaymentEvent(deps, e1), handlePaymentEvent(deps, e2)]);
  assert.equal(count(deps, orderId, 'paid'), 1);
  assert.equal(deps.vendor.calls.length, 1);
});

test('WEBHOOK: amount mismatch -> failed_needs_attention, alert, NO submission', async () => {
  const deps = makeDeps();
  const { orderId } = await newOrder(deps);
  const evt = paidEvent(deps, orderId, { amountAgorot: 7900 }); // paid the product price, not the total
  const r = await handlePaymentEvent(deps, evt);
  assert.equal(r.outcome, 'mismatch');
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^amount_mismatch/);
  assert.equal(deps.vendor.calls.length, 0);
  assert.equal(count(deps, orderId, 'alert_amount_mismatch'), 1);
  // a missing amount is also a mismatch (fail closed)
  const d2 = makeDeps();
  const o2 = await newOrder(d2);
  const e2 = paidEvent(d2, o2.orderId);
  e2.amountAgorot = null;
  assert.equal((await handlePaymentEvent(d2, e2)).outcome, 'mismatch');
  // wrong currency is a mismatch too
  const d3 = makeDeps();
  const o3 = await newOrder(d3);
  const e3 = paidEvent(d3, o3.orderId);
  e3.currency = 'USD';
  assert.equal((await handlePaymentEvent(d3, e3)).outcome, 'mismatch');
  assert.equal(d3.vendor.calls.length, 0);
  // and admin retry_submit refuses an order that was never paid in full
  await assert.rejects(
    adminAction(deps, { id: orderId, action: 'retry_submit', actor: ADMIN }),
    (e) => e instanceof OrderError && e.code === 'retry_not_allowed',
  );
  assert.equal(deps.vendor.calls.length, 0);
});

test('WEBHOOK: unknown order id is ignored, not created', async () => {
  const deps = makeDeps();
  const r = await handlePaymentEvent(deps, { orderId: '11111111-1111-4111-8111-111111111111', amountAgorot: 1, currency: 'ILS' });
  assert.equal(r.outcome, 'unknown_order');
  assert.equal(deps.store._orders.size, 0);
});

test('WEBHOOK: payment for a cancelled order is flagged, never fulfilled', async () => {
  const deps = makeDeps();
  const { orderId } = await newOrder(deps);
  await adminAction(deps, { id: orderId, action: 'cancel', actor: ADMIN });
  const r = await handlePaymentEvent(deps, paidEvent(deps, orderId));
  assert.equal(r.outcome, 'paid_after_cancel');
  assert.equal(deps.store._orders.get(orderId).status, 'failed_needs_attention');
  assert.equal(deps.vendor.calls.length, 0);
});

test('UNKNOWN OUTCOME (timeout): no automatic resubmission; admin retry is explicit', async () => {
  const deps = makeDeps({ vendorScript: ['timeout', 'success'] });
  const { orderId } = await newOrder(deps);
  const evt = paidEvent(deps, orderId);
  await handlePaymentEvent(deps, evt);
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^unknown_outcome/);
  assert.equal(deps.vendor.calls.length, 1);
  // re-delivery of the payment event, a non-explicit submit, and the cron must NOT submit again
  await handlePaymentEvent(deps, evt);
  assert.equal(await submitOrder(deps, orderId, { explicit: false }).catch((e) => e.code), 'retry_not_allowed');
  await runStuckWatch({ ...deps, now: () => new Date(Date.now() + 5 * 3600 * 1000) });
  assert.equal(deps.vendor.calls.length, 1, 'still exactly one call');
  // an explicit admin retry WITHOUT the reconcile confirmation is refused
  assert.equal(await adminAction(deps, { id: orderId, action: 'retry_submit', actor: ADMIN }).catch((e) => e.code), 'reconcile_required');
  assert.equal(deps.vendor.calls.length, 1);
  // with the confirmation that a human checked the partner side, it goes through (mock now succeeds)
  const out = await adminAction(deps, { id: orderId, action: 'retry_submit', actor: ADMIN, note: 'checked with partner', confirmNotOrdered: true });
  assert.equal(out.order.status, 'submitted');
  assert.equal(deps.vendor.calls.length, 2);
  assert.equal(deps.store._orders.get(orderId).vendor_submit_attempts, 2);
  assert.equal(count(deps, orderId, 'submit_unknown_outcome'), 1);
  assert.equal(count(deps, orderId, 'admin_retry_submit'), 2, 'the refused attempt and the confirmed one are both logged');
});

test('REJECTION: marked failed_needs_attention with a note, not retried automatically', async () => {
  const deps = makeDeps({ vendorScript: ['reject'] });
  const { orderId } = await newOrder(deps);
  await handlePaymentEvent(deps, paidEvent(deps, orderId));
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^rejected:/);
  assert.equal(deps.vendor.calls.length, 1);
});

test('vendor disabled: order stays paid (nothing was sent)', async () => {
  const deps = makeDeps({ vendorScript: ['disabled'] });
  const { orderId } = await newOrder(deps);
  await handlePaymentEvent(deps, paidEvent(deps, orderId));
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'paid');
  assert.equal(row.vendor_last_error, 'vendor_disabled');
});

test('missing print files -> failed_needs_attention, vendor never called', async () => {
  const deps = makeDeps({ withFiles: false });
  const { orderId } = await newOrder(deps);
  await handlePaymentEvent(deps, paidEvent(deps, orderId));
  assert.equal(deps.store._orders.get(orderId).status, 'failed_needs_attention');
  assert.equal(deps.store._orders.get(orderId).vendor_last_error, 'print_files_missing');
  assert.equal(deps.vendor.calls.length, 0);
});

test('state machine: illegal admin transitions are rejected', async () => {
  const deps = makeDeps();
  const { orderId } = await newOrder(deps);
  await assert.rejects(adminAction(deps, { id: orderId, action: 'mark_shipped', actor: ADMIN }), (e) => e.code === 'invalid_transition');
  await handlePaymentEvent(deps, paidEvent(deps, orderId));
  await assert.rejects(adminAction(deps, { id: orderId, action: 'cancel', actor: ADMIN }), (e) => e.code === 'invalid_transition');
  await assert.rejects(adminAction(deps, { id: orderId, action: 'mark_ready_for_pickup', actor: ADMIN }), (e) => e.code === 'not_pickup');
  const shipped = await adminAction(deps, { id: orderId, action: 'mark_shipped', actor: ADMIN, note: 'https://track.test/abc' });
  assert.equal(shipped.order.status, 'shipped');
  assert.equal(shipped.order.tracking_url, 'https://track.test/abc');
  await assert.rejects(adminAction(deps, { id: orderId, action: 'cancel', actor: ADMIN }), (e) => e.code === 'invalid_transition');
  await assert.rejects(adminAction(deps, { id: orderId, action: 'explode', actor: ADMIN }), (e) => e.code === 'invalid_action');
});

test('CRON watcher: alert recorded once per order, webhook posted once, nothing for fresh orders', async () => {
  const posts = [];
  const fetchImpl = async (url, init) => { posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const deps = makeDeps({ vendorScript: ['disabled'], env: { PRINT_ALERT_WEBHOOK_URL: 'https://alerts.test/hook' } });
  const { orderId } = await newOrder(deps);
  await handlePaymentEvent(deps, paidEvent(deps, orderId)); // stays "paid"
  const healthy = await newOrder(deps, { idempotencyKey: 'key-0002-bbbb' });
  const t0 = Date.now();

  // 1h later: not stuck yet
  let r = await runStuckWatch({ ...deps, fetchImpl, now: () => new Date(t0 + 3600 * 1000) });
  assert.equal(r.checked, 0);
  assert.equal(posts.length, 0);
  // 3h later: stuck -> one alert, one post
  r = await runStuckWatch({ ...deps, fetchImpl, now: () => new Date(t0 + 3 * 3600 * 1000) });
  assert.deepEqual([r.checked, r.newAlerts, r.delivery], [1, 1, 'sent']);
  // run again twice: no new alert, no new post
  await runStuckWatch({ ...deps, fetchImpl, now: () => new Date(t0 + 4 * 3600 * 1000) });
  r = await runStuckWatch({ ...deps, fetchImpl, now: () => new Date(t0 + 5 * 3600 * 1000) });
  assert.equal(r.newAlerts, 0);
  assert.equal(count(deps, orderId, 'alert_stuck:paid'), 1);
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].body.orders.map((o) => o.id), [orderId]);
  assert.ok(!JSON.stringify(posts[0].body).includes(healthy.orderId));
  // without a webhook url: alert row only, no network
  const d2 = makeDeps({ vendorScript: ['disabled'] });
  const o2 = await newOrder(d2);
  await handlePaymentEvent(d2, paidEvent(d2, o2.orderId));
  const noNet = async () => { throw new Error('network must not be used'); };
  r = await runStuckWatch({ ...d2, fetchImpl: noNet, now: () => new Date(Date.now() + 3 * 3600 * 1000) });
  assert.deepEqual([r.newAlerts, r.delivery], [1, 'not_configured']);
});

test('CRON watcher: a failed delivery is retried next run without duplicating the alert row', async () => {
  let ok = false;
  const posts = [];
  const fetchImpl = async (u, init) => { posts.push(init.body); return { ok, status: ok ? 200 : 500 }; };
  const deps = makeDeps({ vendorScript: ['reject'], env: { PRINT_ALERT_WEBHOOK_URL: 'https://alerts.test/hook' } });
  const { orderId } = await newOrder(deps);
  await handlePaymentEvent(deps, paidEvent(deps, orderId)); // failed_needs_attention
  let r = await runStuckWatch({ ...deps, fetchImpl });
  assert.equal(r.delivery, 'failed_500');
  ok = true;
  r = await runStuckWatch({ ...deps, fetchImpl });
  assert.equal(r.delivery, 'sent');
  assert.equal(r.newAlerts, 0);
  assert.equal(count(deps, orderId, 'alert_stuck:failed_needs_attention'), 1);
  assert.equal(posts.length, 2);
});
