// Vendor client vs the OFFICIAL API shapes (Create Book v5.1, Create Order v1.2, Calculate Order Price v1.1,
// Shipment Tracking v1.1). The transport is a recorded/mocked fetch built from the documented requests and
// responses. No test here touches the network.
import test from 'node:test';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { createVendorClient, buildShippingDetails, gsUriFromUploadUrl, DEFAULT_API_BASE } from '../api/_lib/bookpod/client.js';
import { expectedVendorTotalAgorot } from '../api/_lib/bookpod/expected.js';
import { createPrintFilesProvider } from '../api/_lib/orders/printFiles.js';
import { handlePaymentEvent, submitOrder } from '../api/_lib/orders/service.js';
import { normalizeCreemEvent } from '../api/_lib/orders/payment/creem.js';
import { endpoint } from '../api/_lib/orders/handlers.js';
import { ALICE, GOOD_ADDRESS, call, fakeReq, makeDeps } from './orders-helpers.mjs';

const TOKEN = 'tok_' + 'x'.repeat(32);
const ENV = Object.freeze({
  BOOKPOD_ENABLED: 'true',
  BOOKPOD_API_TOKEN: TOKEN,
  BOOKPOD_USER_ID: 'Sipurai',
  BOOKPOD_CONTACT_EMAIL: 'print@sipurai.test',
});
const GCS = 'https://storage.googleapis.com/upload/storage/v1/b/bookpod-profile-images/o?uploadType=resumable&name=';
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A fake vendor that answers with the documented response shapes and records everything. */
function fakeVendor(knobs = {}) {
  const calls = [];
  const refs = new Set();
  let books = 0;
  let priceCalls = 0;
  const f = async (url, init = {}) => {
    const path = url.startsWith(DEFAULT_API_BASE) ? url.slice(DEFAULT_API_BASE.length) : url;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ method: init.method || 'GET', path, headers: init.headers || {}, body });
    if (knobs.fail?.(path, init)) return knobs.fail(path, init);
    if (path === '/api/v1/books/upload-url') {
      return json(200, {
        contentUploadUrl: `${GCS}${body.contentFileName}`,
        coverUploadUrl: `${GCS}${body.coverFileName}`,
        contentFileName: body.contentFileName,
        coverFileName: body.coverFileName,
      });
    }
    if (path.startsWith(GCS)) return knobs.putStatus ? json(knobs.putStatus, {}) : json(200, {});
    if (path === '/api/v1/books') {
      books += 1;
      return json(201, { success: true, bookid: 33990 + books });
    }
    if (path === '/api/v1/orders/price') {
      const seq = knobs.totalSeq ? knobs.totalSeq[Math.min(priceCalls, knobs.totalSeq.length - 1)] : undefined;
      priceCalls += 1;
      return json(200, { success: true, currency: 'ILS', itemsSubtotal: 24.66, shipping: { method: 2, price: 29 }, total: seq ?? knobs.total ?? 53.66, priceable: knobs.priceable ?? true, validationErrors: [] });
    }
    if (path === '/api/v1/orders') {
      if (refs.has(body.shippingDetails.reference_num1)) return json(400, { success: false, code: 1502, message: 'reference_num1 already exists' });
      refs.add(body.shippingDetails.reference_num1);
      if (knobs.orderStatus === 202) {
        return json(202, { success: true, order_no: '00001613', status: 'CREATED_ERROR', hasErrors: true, errors: [{ code: 1506, message: 'Some books do not exist in the DB: 999' }], warnings: [] });
      }
      return json(201, { success: true, order_no: '00001612', status: 'CREATED', message: 'Order created successfully', hasErrors: false, warnings: [] });
    }
    if (path.startsWith('/api/v1/shipments/track')) {
      return json(200, { trackingNumber: '00001612', companyName: 'Kexpress', status: 'נמסר', statusDate: '2026-11-12T00:00:00.000Z' });
    }
    return json(404, { error: 'unexpected ' + path });
  };
  f.calls = calls;
  f.count = (m, p) => calls.filter((c) => c.method === m && c.path === p).length;
  return f;
}

const ORDER = Object.freeze({
  id: '11111111-2222-4333-8444-555555555555',
  preset_id: 'square-220',
  page_count: 24,
  qty: 1,
  method: 'ship',
  address: { ...GOOD_ADDRESS, houseNumber: '12א' },
  quote: { presetId: 'square-220', pageCount: 24, bookTitle: 'הדרקון של נועה' },
});
const FILES = { content: new Uint8Array([37, 80, 68, 70, 1, 2, 3]), cover: new Uint8Array([37, 80, 68, 70, 9]) };
const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'no-error'; };

test('expected cost for the measured proof: 1 copy 22x22 shipped = 53.66 ILS', () => {
  assert.equal(expectedVendorTotalAgorot(ORDER, {}), 5366);
  assert.equal(expectedVendorTotalAgorot({ ...ORDER, method: 'pickup' }, {}), 2466);
  assert.equal(expectedVendorTotalAgorot({ ...ORDER, qty: 3 }, {}), 3 * 2466 + 2900);
});

test('HAPPY PATH: documented flow, in order, with documented shapes', async () => {
  const f = fakeVendor();
  const c = createVendorClient({ env: ENV, fetchImpl: f, now: () => Date.UTC(2026, 10, 10) });
  const out = await c.submitOrder(ORDER, FILES);
  assert.deepEqual(out, { ref: '00001612' });

  assert.deepEqual(f.calls.map((x) => `${x.method} ${x.path.startsWith(GCS) ? 'GCS' : x.path}`), [
    'POST /api/v1/books/upload-url', 'PUT GCS', 'PUT GCS', 'POST /api/v1/books', 'POST /api/v1/orders/price', 'POST /api/v1/orders',
  ]);
  const [urlReq, put1, put2, book, price, order] = f.calls;
  assert.equal(urlReq.headers['x-user-id'], 'Sipurai');
  assert.equal(urlReq.headers['x-custom-token'], TOKEN);
  assert.match(urlReq.body.contentFileName, /^[a-z0-9-]+_202611_v1\.0\.pdf$/);
  // the signed storage URL gets the PDF and NEVER the vendor token
  for (const p of [put1, put2]) {
    assert.equal(p.headers['Content-Type'], 'application/pdf');
    assert.equal(p.headers['x-custom-token'], undefined);
    assert.equal(p.headers['x-user-id'], undefined);
  }
  assert.equal(put1.body.length, 7);
  assert.equal(put2.body.length, 5);
  // Create Book: documented metadata, gs:// uris, unlisted
  assert.deepEqual(
    { ...book.body, title: undefined, contentUrl: undefined, coverUrl: undefined },
    { title: undefined, category: ['childrens'], bookType: 'print', printcolor: 'color', sheettype: 'wood-free-white-110', laminationtype: 'matt', finishtype: 'soft', readingdirection: 'right', bleed: true, width: 22, height: 22, status: false, contentUrl: undefined, coverUrl: undefined },
  );
  assert.equal(book.body.title, 'הדרקון של נועה');
  assert.match(book.body.contentUrl, /^gs:\/\/bookpod-profile-images\/.+_v1\.0\.pdf$/);
  assert.match(book.body.coverUrl, /^gs:\/\/bookpod-profile-images\/.+_cover_v1\.0\.pdf$/);
  // price call and order call carry the same body (docs: "same request body as Create Order")
  assert.deepEqual(price.body, order.body);
  assert.deepEqual(order.body.items, [{ bookid: 33991, quantity: 1 }]);
  assert.deepEqual(order.body.shippingDetails, {
    shippingMethod: 2,
    name: 'דנה כהן',
    phoneNumber: '0501234567',
    email: 'print@sipurai.test', // OUR address: the customer never gets mail from the partner
    reference_num1: ORDER.id,
    city: 'חיפה',
    street: 'הנשיא',
    house: '12',
    zipCode: '3500000',
    notes: 'מספר בית: 12א',
  });
  assert.equal(JSON.stringify(f.calls).includes('"shippingCompanyId"'), false, 'local shipments omit shippingCompanyId');
});

test('shippingDetails: pickup = factory self-pickup (3); zip missing and bad contact are refused before any I/O', async () => {
  assert.equal(buildShippingDetails({ ...ORDER, method: 'pickup' }, ENV).shippingMethod, 3);
  const f = fakeVendor();
  const c = createVendorClient({ env: ENV, fetchImpl: f });
  assert.equal(await code(c.submitOrder({ ...ORDER, address: { ...ORDER.address, zip: undefined } }, FILES)), 'vendor_rejected');
  const noEmail = createVendorClient({ env: { ...ENV, BOOKPOD_CONTACT_EMAIL: '' }, fetchImpl: f });
  assert.equal(await code(noEmail.submitOrder(ORDER, FILES)), 'vendor_not_configured');
  assert.equal(f.calls.length, 0);
});

test('env: BOOKPOD_API_TOKEN is read; BOOKPOD_API_KEY is only the fallback; token wins when both are set', async () => {
  const mk = (env) => { const f = fakeVendor(); return [createVendorClient({ env, fetchImpl: f }), f]; };
  const { BOOKPOD_API_TOKEN, ...noToken } = ENV;
  void BOOKPOD_API_TOKEN;
  let [c, f] = mk({ ...noToken, BOOKPOD_API_KEY: 'legacy-key' });
  await c.submitOrder(ORDER, FILES);
  assert.equal(f.calls[0].headers['x-custom-token'], 'legacy-key');
  [c, f] = mk({ ...ENV, BOOKPOD_API_KEY: 'legacy-key' });
  await c.submitOrder(ORDER, FILES);
  assert.equal(f.calls[0].headers['x-custom-token'], TOKEN);
  [c, f] = mk({ ...noToken });
  assert.equal(await code(c.submitOrder(ORDER, FILES)), 'vendor_disabled');
  assert.equal(f.calls.length, 0);
});

test('UPLOAD FAILURE: nothing is created at the partner, outcome is a SAFE (retryable) failure', async () => {
  for (const putStatus of [403, 500]) {
    const f = fakeVendor({ putStatus });
    const c = createVendorClient({ env: ENV, fetchImpl: f });
    const e = await c.submitOrder(ORDER, FILES).catch((x) => x);
    assert.equal(e.code, 'vendor_upload_failed', String(putStatus));
    assert.equal(e.unknownOutcome, false);
    assert.equal(f.count('POST', '/api/v1/books'), 0);
    assert.equal(f.count('POST', '/api/v1/orders'), 0);
  }
  // network error while uploading
  const f = fakeVendor();
  const boom = async (url, init) => { if (String(url).startsWith(GCS)) throw new Error('ECONNRESET'); return f(url, init); };
  assert.equal(await code(createVendorClient({ env: ENV, fetchImpl: boom }).submitOrder(ORDER, FILES)), 'vendor_upload_failed');
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
});

test('PRICE GATE: a partner price that differs by more than the margin refuses the order (fail closed)', async () => {
  const run = async (total, env = ENV, priceable = true) => {
    const f = fakeVendor({ total, priceable });
    const c = createVendorClient({ env, fetchImpl: f });
    const e = await c.submitOrder(ORDER, FILES).catch((x) => x);
    return { e, f };
  };
  // expected 53.66, default margin 2.00 ILS
  let { e, f } = await run(80);
  assert.equal(e.code, 'vendor_price_mismatch');
  assert.equal(e.unknownOutcome, false);
  assert.equal(f.count('POST', '/api/v1/orders'), 0, 'no order is created on a price mismatch');
  assert.equal(f.count('POST', '/api/v1/orders/price'), 1, 'the price call always happens first');
  // too LOW is refused as well: a missing line is as suspicious as an extra one
  ({ e, f } = await run(30));
  assert.equal(e.code, 'vendor_price_mismatch');
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
  // inside the margin passes; boundary is inclusive at 2.00
  ({ e, f } = await run(55.66));
  assert.deepEqual(e, { ref: '00001612' });
  ({ e, f } = await run(55.67));
  assert.equal(e.code, 'vendor_price_mismatch');
  // the margin is configurable
  ({ e } = await run(57, { ...ENV, BOOKPOD_PRICE_MARGIN_AGOROT: '500' }));
  assert.deepEqual(e, { ref: '00001612' });
  // not priceable / zero total
  ({ e, f } = await run(53.66, ENV, false));
  assert.equal(e.code, 'vendor_price_mismatch');
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
});

test('TOKEN EXPIRED: explicit code, no retry storm (breaker), recovers after the window', async () => {
  let t = Date.UTC(2026, 10, 10, 8, 0, 0);
  const expired = () => json(401, { error: 'Unauthorized', message: 'Token expired' });
  let f = fakeVendor({ fail: (path) => (path === '/api/v1/books/upload-url' ? expired() : null) });
  const c = createVendorClient({ env: ENV, fetchImpl: f, now: () => t });
  const first = await c.submitOrder(ORDER, FILES).catch((x) => x);
  assert.equal(first.code, 'vendor_token_expired');
  assert.equal(first.unknownOutcome, false);
  const after1 = f.calls.length;
  for (let i = 0; i < 5; i += 1) assert.equal(await code(c.submitOrder(ORDER, FILES)), 'vendor_token_expired');
  assert.equal(f.calls.length, after1, 'five more submissions made zero network calls');
  assert.equal(await code(c.getStatus('1')), 'vendor_token_expired');
  t += 11 * 60 * 1000;
  assert.equal(await code(c.submitOrder(ORDER, FILES)), 'vendor_token_expired');
  assert.ok(f.calls.length > after1, 'after the window it tries again (and meets the same 401)');
  // a plain invalid token is a different, also non-retried, code
  f = fakeVendor({ fail: () => json(401, { error: 'Unauthorized', message: 'Invalid token or user ID' }) });
  assert.equal(await code(createVendorClient({ env: ENV, fetchImpl: f }).submitOrder(ORDER, FILES)), 'vendor_auth_failed');
});

test('TOKEN EXPIRED through the service: order goes to needs-attention with a clear reason and an alert, nothing ordered', async () => {
  const f = fakeVendor({ fail: (path) => (path === '/api/v1/books/upload-url' ? json(401, { message: 'Token expired' }) : null) });
  const deps = makeDeps();
  deps.vendor = createVendorClient({ env: ENV, fetchImpl: f });
  deps.getPrintFiles = async () => FILES;
  const { orderId } = await place(deps);
  await handlePaymentEvent(deps, paid(deps, orderId, 'evt_tok'));
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^token_expired: nothing was ordered/);
  assert.ok(deps.store._events.some((e) => e.order_id === orderId && e.type === 'alert_vendor_auth'));
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
  // after the token is renewed an explicit retry works
  deps.vendor = createVendorClient({ env: ENV, fetchImpl: fakeVendor() });
  const r = await submitOrder(deps, orderId, { explicit: true });
  assert.equal(r.outcome, 'submitted');
});

test('PRICE MISMATCH through the service: needs-attention + alert_price_mismatch, nothing ordered', async () => {
  const f = fakeVendor({ total: 99 });
  const deps = makeDeps();
  deps.vendor = createVendorClient({ env: ENV, fetchImpl: f });
  deps.getPrintFiles = async () => FILES;
  const { orderId } = await place(deps);
  await handlePaymentEvent(deps, paid(deps, orderId, 'evt_pm'));
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^price_mismatch: nothing was ordered/);
  assert.ok(deps.store._events.some((e) => e.order_id === orderId && e.type === 'alert_price_mismatch'));
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
});

test('order outcome classes: 5xx / timeout / 1502 / 202 are UNKNOWN; 4xx is a definite refusal', async () => {
  const orderFails = (impl) => fakeVendor({ fail: (path) => (path === '/api/v1/orders' ? impl() : null) });
  const run = (f) => createVendorClient({ env: ENV, fetchImpl: f }).submitOrder(ORDER, FILES).catch((x) => x);
  let e = await run(orderFails(() => json(503, {})));
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_unknown', true]);
  e = await run(orderFails(() => json(400, { success: false, code: 1501, message: 'Missing books in the system' })));
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_rejected', false]);
  e = await run(orderFails(() => json(400, { success: false, code: 1502, message: 'reference_num1 already exists' })));
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_duplicate_reference', true]);
  e = await run(fakeVendor({ orderStatus: 202 }));
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_created_with_errors', true]);
  assert.match(e.message, /order_no 00001613/);
  const abort = fakeVendor({ fail: (path) => { if (path === '/api/v1/orders') { const x = new Error('a'); x.name = 'AbortError'; throw x; } return null; } });
  e = await run(abort);
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_timeout', true]);
  // a doubt BEFORE the order call is a safe failure
  e = await run(fakeVendor({ fail: (path) => (path === '/api/v1/books' ? json(500, {}) : null) }));
  assert.deepEqual([e.code, e.unknownOutcome], ['vendor_prestep_failed', false]);
});

test('CODEX #2: at the order call only a DOCUMENTED refusal proves "not created"; every other 4xx is UNKNOWN', async () => {
  const run = (resp) => createVendorClient({ env: ENV, fetchImpl: fakeVendor({ fail: (path) => (path === '/api/v1/orders' ? resp : null) }) })
    .submitOrder(ORDER, FILES).catch((e) => e);
  const unknown = [
    json(408, {}), json(429, { error: 'slow down' }), json(400, { weird: true }), json(404, null),
    json(400, { success: false, code: 9999, message: 'undocumented' }),
    json(401, { message: 'gateway says no' }), // 401 without the documented body at the order stage
    json(400, { success: true, code: 1501 }), // wrong shape: success must be false
  ];
  for (const r of unknown) {
    const e = await run(r);
    assert.deepEqual([e.code, e.unknownOutcome], [r.status === 401 ? 'vendor_unknown' : 'vendor_unknown', true], `status ${r.status}`);
  }
  // NEGATIVE CONTROL: the documented refusals ARE definite
  for (const c of [1100, 1501, 1506, 1507]) {
    const e = await run(json(400, { success: false, code: c, message: 'documented' }));
    assert.deepEqual([e.code, e.unknownOutcome], ['vendor_rejected', false], String(c));
  }
  assert.equal((await run(json(401, { error: 'Unauthorized', message: 'Token expired' }))).code, 'vendor_token_expired');
});

test('CODEX #2 through the service: an unknown outcome cannot be resubmitted without the reconcile confirmation; a safe failure can', async () => {
  const deps = makeDeps({ withFiles: false });
  let mode = 'unknown';
  const f = fakeVendor({ fail: (path) => (path === '/api/v1/orders' && mode === 'unknown' ? json(408, {}) : null) });
  deps.vendor = createVendorClient({ env: ENV, fetchImpl: f });
  deps.getPrintFiles = async () => FILES;
  const { orderId } = await place(deps);
  await handlePaymentEvent(deps, paid(deps, orderId, 'evt_unk'));
  const row = () => deps.store._orders.get(orderId);
  assert.equal(row().status, 'failed_needs_attention');
  assert.match(row().vendor_last_error, /^unknown_outcome\(vendor_unknown\)/);
  const before = f.count('POST', '/api/v1/orders');
  mode = 'ok';
  const e1 = await submitOrder(deps, orderId, { explicit: true }).catch((e) => e);
  assert.equal(e1.code, 'reconcile_required');
  assert.equal(f.count('POST', '/api/v1/orders'), before, 'no order request without the confirmation');
  const r = await submitOrder(deps, orderId, { explicit: true, confirmNotOrdered: true });
  assert.equal(r.outcome, 'submitted');
  // a SAFE failure (documented refusal) is retryable without the confirmation
  const deps2 = makeDeps({ withFiles: false });
  deps2.vendor = createVendorClient({ env: ENV, fetchImpl: fakeVendor({ total: 99 }) });
  deps2.getPrintFiles = async () => FILES;
  const o2 = await place(deps2);
  await handlePaymentEvent(deps2, paid(deps2, o2.orderId, 'evt_safe'));
  deps2.vendor = createVendorClient({ env: ENV, fetchImpl: fakeVendor() });
  assert.equal((await submitOrder(deps2, o2.orderId, { explicit: true })).outcome, 'submitted');
});

test('getStatus uses GET /shipments/track by our partner order number', async () => {
  const f = fakeVendor();
  const c = createVendorClient({ env: ENV, fetchImpl: f });
  assert.deepEqual(await c.getStatus('00001612'), { status: 'נמסר', trackingUrl: null });
  assert.equal(f.calls[0].path, '/api/v1/shipments/track?trackingNumber=00001612');
  assert.equal(f.calls[0].method, 'GET');
});

test('quote(): read-only price call, never uploads or orders', async () => {
  const f = fakeVendor();
  const c = createVendorClient({ env: ENV, fetchImpl: f });
  const q = await c.quote(ORDER, 33377);
  assert.equal(q.totalAgorot, 5366);
  assert.equal(q.expectedAgorot, 5366);
  assert.deepEqual(f.calls.map((x) => x.path), ['/api/v1/orders/price']);
});

test('orderExistingBook (first live order): needs an approval, same price gate, no upload, one order call', async () => {
  const mk = (knobs) => { const f = fakeVendor(knobs); return [createVendorClient({ env: ENV, fetchImpl: f }), f]; };
  let [c, f] = mk();
  const q = await c.quote(ORDER, 33377);
  const ok = await c.orderExistingBook(ORDER, 33377, { totalAgorot: q.totalAgorot, fingerprint: q.fingerprint });
  assert.deepEqual(ok, { ref: '00001612' });
  assert.deepEqual(f.calls.map((x) => x.path), ['/api/v1/orders/price', '/api/v1/orders/price', '/api/v1/orders']);
  assert.equal(f.calls[2].body.items[0].bookid, 33377);
  // no approval -> refused before any call
  [c, f] = mk();
  assert.equal(await code(c.orderExistingBook(ORDER, 33377)), 'vendor_rejected');
  assert.equal(f.calls.length, 0);
});

test('FIRST ORDER binding: price moves 53.66 -> 55.66 between approval and order -> refused, nothing ordered (control: the margin gate alone would accept 55.66)', async () => {
  const f = fakeVendor({ totalSeq: [53.66, 55.66] });
  const c = createVendorClient({ env: ENV, fetchImpl: f });
  const q = await c.quote(ORDER, 33377); // the owner sees and approves 53.66
  assert.equal(q.totalAgorot, 5366);
  const e = await c.orderExistingBook(ORDER, 33377, { totalAgorot: q.totalAgorot, fingerprint: q.fingerprint }).catch((x) => x);
  assert.equal(e.code, 'vendor_price_mismatch');
  assert.match(e.message, /price changed since approval/);
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
  // NEGATIVE CONTROL: had the owner approved 55.66, the very same second price is accepted by the same code path,
  // so the refusal above is caused by the binding and not by the margin gate.
  const f2 = fakeVendor({ totalSeq: [55.66] });
  const c2 = createVendorClient({ env: ENV, fetchImpl: f2 });
  const q2 = await c2.quote(ORDER, 33377);
  assert.deepEqual(await c2.orderExistingBook(ORDER, 33377, { totalAgorot: 5566, fingerprint: q2.fingerprint }), { ref: '00001612' });
});

test('FIRST ORDER binding: a different address / quantity than the approved request is refused', async () => {
  const f = fakeVendor();
  const c = createVendorClient({ env: ENV, fetchImpl: f });
  const q = await c.quote(ORDER, 33377);
  for (const changed of [
    { ...ORDER, address: { ...ORDER.address, street: 'אחר' } },
    { ...ORDER, qty: 2 },
    { ...ORDER, id: 'other-id' },
  ]) {
    assert.equal(await code(c.orderExistingBook(changed, 33377, { totalAgorot: q.totalAgorot, fingerprint: q.fingerprint })), 'vendor_price_mismatch');
  }
  assert.equal(await code(c.orderExistingBook(ORDER, 99999, { totalAgorot: q.totalAgorot, fingerprint: q.fingerprint })), 'vendor_price_mismatch');
  assert.equal(f.count('POST', '/api/v1/orders'), 0);
});

test('gsUriFromUploadUrl derives gs://<bucket>/<file> from the documented signed-URL shape', () => {
  assert.equal(gsUriFromUploadUrl(`${GCS}a.pdf`, 'a.pdf'), 'gs://bookpod-profile-images/a.pdf');
  assert.equal(gsUriFromUploadUrl('https://x.test/nope', 'a.pdf'), null);
});

/* ------------------------------ idempotency ------------------------------ */
const create = endpoint('create');
async function place(deps) {
  const r = await call(create, fakeReq({
    method: 'POST', user: ALICE,
    body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-0001-bpod' },
  }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
const paid = (deps, orderId, eventId) =>
  normalizeCreemEvent(deps.payment.buildCompletedEvent(deps.store._orders.get(orderId), { eventId }).event);

async function realFlowDeps(f) {
  const deps = makeDeps({ withFiles: false });
  deps.vendor = createVendorClient({ env: ENV, fetchImpl: f });
  deps.getPrintFiles = async () => FILES;
  return deps;
}

test('IDEMPOTENCY: duplicate / concurrent webhook deliveries create exactly ONE partner order (reference_num1 = our order id)', async () => {
  const f = fakeVendor();
  const deps = await realFlowDeps(f);
  const { orderId } = await place(deps);
  const results = await Promise.all([
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_a')),
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_a')),
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_b')),
  ]);
  assert.equal(results.filter((r) => r.outcome === 'paid').length, 1);
  assert.equal(f.count('POST', '/api/v1/orders'), 1, 'exactly one order request reached the partner');
  const orderCall = f.calls.find((c) => c.path === '/api/v1/orders');
  assert.equal(orderCall.body.shippingDetails.reference_num1, orderId);
  assert.equal(deps.store._orders.get(orderId).status, 'submitted');
  assert.equal(deps.store._orders.get(orderId).vendor_ref, '00001612');
  // and a later redelivery changes nothing
  assert.equal((await handlePaymentEvent(deps, paid(deps, orderId, 'evt_a'))).outcome, 'duplicate');
  assert.equal(f.count('POST', '/api/v1/orders'), 1);
});

test('IDEMPOTENCY NEGATIVE CONTROL: with the atomic claim removed, the same test sees more than one order request', async () => {
  const f = fakeVendor();
  const deps = await realFlowDeps(f);
  const real = deps.store.transition.bind(deps.store);
  void real;
  // Broken store: every transition "wins" (no compare-and-set on the current status).
  deps.store.transition = async (id, _from, patch) => deps.store.update(id, patch);
  const { orderId } = await place(deps);
  await Promise.all([
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_a')),
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_a')),
    handlePaymentEvent(deps, paid(deps, orderId, 'evt_b')),
  ]);
  assert.ok(f.count('POST', '/api/v1/orders') > 1, `control must fail the guarantee, got ${f.count('POST', '/api/v1/orders')}`);
});

/* --------------------------- print file generation --------------------------- */
function solidPng(n) {
  // n x n flat-colour RGB PNG; compresses to a few KB but decodes to 3n^2 bytes (>= 300 dpi at 200 mm for n >= 2362)
  const crcTable = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(n * 3, 200)]);
  const raw = Buffer.concat(Array.from({ length: n }, () => row));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const memStorage = (files) => ({ async download(bucket, path) { return files.get(`${bucket}/${path}`) || null; } });

test('getPrintFiles: missing artwork -> null (service records print_files_missing), nothing built', async () => {
  let built = false;
  const p = createPrintFilesProvider({ storage: memStorage(new Map()), build: async () => { built = true; }, log: () => {} });
  assert.equal(await p.getPrintFiles({ page_count: 24, preset_id: 'square-220' }, { id: 'book-alice' }), null);
  assert.equal(built, false);
});

test('getPrintFiles: builds BookPod-sized PDFs from stored artwork (22x22, 3.2 mm bleed, flat cover with 1.8 mm spine)', async () => {
  const png = solidPng(2400);
  const files = new Map();
  for (let i = 1; i <= 24; i += 1) files.set(`print-artwork/book-alice/page-${String(i).padStart(2, '0')}.png`, png);
  files.set('print-artwork/book-alice/front.png', png);
  files.set('print-artwork/book-alice/back.png', png);
  const p = createPrintFilesProvider({ storage: memStorage(files), log: () => {} });
  const out = await p.getPrintFiles({ page_count: 24, preset_id: 'square-220' }, { id: 'book-alice' });
  assert.deepEqual(out.meta.interiorPageSizeMm, { widthMm: 226.4, heightMm: 226.4 });
  assert.deepEqual(out.meta.coverSizeMm, { widthMm: 448.2, heightMm: 226.4 });
  assert.equal(out.meta.spineMm, 1.8);
  const head = (u8) => Buffer.from(u8.slice(0, 20000)).toString('latin1');
  const mm = (pt) => Math.round((pt * 25.4) / 72 * 10) / 10;
  const box = (u8) => /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(Buffer.from(u8).toString('latin1'));
  assert.equal(head(out.content).startsWith('%PDF'), true);
  const ib = box(out.content);
  assert.deepEqual([mm(+ib[1]), mm(+ib[2])], [226.4, 226.4]);
  const cb = box(out.cover);
  assert.deepEqual([mm(+cb[1]), mm(+cb[2])], [448.2, 226.4]);
  // one-page flat spread (docs 6a: "The file must have exactly one page")
  assert.equal((Buffer.from(out.cover).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
  assert.equal((Buffer.from(out.content).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 24);
});

test('getPrintFiles: artwork below 300 dpi is refused by the generator and the service parks the order (no vendor call)', async () => {
  const small = solidPng(800);
  const files = new Map();
  for (let i = 1; i <= 24; i += 1) files.set(`print-artwork/book-alice/page-${String(i).padStart(2, '0')}.png`, small);
  files.set('print-artwork/book-alice/front.png', small);
  files.set('print-artwork/book-alice/back.png', small);
  const f = fakeVendor();
  const deps = await realFlowDeps(f);
  deps.getPrintFiles = createPrintFilesProvider({ storage: memStorage(files), log: () => {} }).getPrintFiles;
  const { orderId } = await place(deps);
  await handlePaymentEvent(deps, paid(deps, orderId, 'evt_dpi'));
  const row = deps.store._orders.get(orderId);
  assert.equal(row.status, 'failed_needs_attention');
  assert.match(row.vendor_last_error, /^print_files_error: Artwork is below 300 dpi/);
  assert.equal(f.calls.length, 0);
});
