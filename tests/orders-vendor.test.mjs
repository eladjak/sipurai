import test from 'node:test';
import assert from 'node:assert/strict';
import { stockBindingDigest, stockFileBinding } from '../api/_lib/bookpod/stockFiles.js';
import { createVendorClient, isVendorEnabled, VendorError } from '../api/_lib/bookpod/client.js';
import { createMockVendor } from '../api/_lib/bookpod/mock.js';
import { createCreemPayment, creemApiBase, PaymentError } from '../api/_lib/orders/payment/creem.js';
import { PRINT_FILES } from './orders-helpers.mjs';

const order = { id: 'o-1', qty: 2, method: 'ship', address: { fullName: 'x' }, preset_id: 'square-220', page_count: 24, quote: { verified: true, presetId: 'square-220', pageCount: 24, paper: 'standard', cover: 'softcover', sheettype: 'wood-free-white-110' } };
const UPLOADED = { vendorIssued: true, contentUrl: 'gs://bucket/content.pdf', coverUrl: 'gs://bucket/cover.pdf' };
const countingFetch = (impl) => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); return impl ? impl(url, init) : { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
  f.calls = calls;
  return f;
};
const codeOf = async (p) => { try { await p; } catch (e) { return e.code; } return 'no-error'; };
const ENABLED = { BOOKPOD_ENABLED: 'true', BOOKPOD_API_KEY: 'k', BOOKPOD_USER_ID: 'u', BOOKPOD_API_BASE: 'https://vendor.test' };

test('vendor OFF: submitOrder/getStatus throw vendor_disabled and fetch is never called', async () => {
  for (const env of [{}, { BOOKPOD_ENABLED: 'true' }, { BOOKPOD_API_KEY: 'k' }, { BOOKPOD_ENABLED: 'false', BOOKPOD_API_KEY: 'k' }, { BOOKPOD_ENABLED: 'TRUE', BOOKPOD_API_KEY: 'k' }]) {
    const f = countingFetch();
    const c = createVendorClient({ env, fetchImpl: f });
    assert.equal(isVendorEnabled(env), false);
    assert.equal(await codeOf(c.submitOrder(order, PRINT_FILES)), 'vendor_disabled', JSON.stringify(env));
    assert.equal(await codeOf(c.getStatus('r')), 'vendor_disabled');
    assert.equal(f.calls.length, 0, 'no network while off');
  }
});

test('CONTROL: when enabled the same client DOES call the network', async () => {
  const f = countingFetch();
  const c = createVendorClient({ env: ENABLED, fetchImpl: f });
  const out = await c.submitOrder(order, UPLOADED);
  assert.equal(out.ref, 'x');
  assert.equal(f.calls.length, 2); // create book, then order
  const payload = JSON.parse(f.calls[0].init.body);
  assert.deepEqual(payload, {
    title: 'Sipurai o-1', category: ['childrens'], bookType: 'print', printcolor: 'color',
    sheettype: 'wood-free-white-110', laminationtype: 'matt', finishtype: 'soft',
    readingdirection: 'right', width: 22, height: 22, bleed: true, status: false,
    contentUrl: UPLOADED.contentUrl, coverUrl: UPLOADED.coverUrl,
  });
  assert.equal(f.calls[0].init.headers['x-user-id'], 'u');
  assert.equal(f.calls[0].init.headers['x-custom-token'], 'k');
  assert.match(f.calls[1].url, /\/api\/v1\/orders$/);
  assert.equal(JSON.parse(f.calls[1].init.body).external_reference, 'o-1');
});

test('invalid or unattested files and mismatched stock cannot cause network calls', async () => {
  const f = countingFetch();
  const client = createVendorClient({env: ENABLED, fetchImpl: f});
  assert.equal(await codeOf(client.submitOrder(order, PRINT_FILES)), 'vendor_rejected');
  assert.equal(await codeOf(client.submitOrder({...order, quote:{...order.quote, sheettype:'chromo-mat-170'}}, UPLOADED)), 'vendor_rejected');
  assert.equal(await codeOf(client.submitOrder({...order, quote:{...order.quote, cover:'hardcover'}}, UPLOADED)), 'vendor_rejected');
  assert.equal(await codeOf(client.submitOrder({...order, quote:{...order.quote, paper:'chrome-matte-130', sheettype:'chromo-mat-130'}}, UPLOADED)), 'vendor_rejected');
  assert.equal(f.calls.length, 0);
});

test('matching trusted file bindings carry each selected stock to CreateBook', async () => {
  for (const [paper,sheettype] of [['chrome-matte-130','chromo-mat-130'], ['chrome-matte-170','chromo-mat-170']]) {
    const proof = {version:1,paper,presetId:'square-220',pageCount:24,cover:'softcover',contentSha256:'a'.repeat(64),coverSha256:'b'.repeat(64),contentUri:'gs://bucket/content.pdf',coverUri:'gs://bucket/cover.pdf',contentGeneration:'101',coverGeneration:'102'};
    const files = {...UPLOADED,proof};
    const boundOrder = {...order, quote:{...order.quote,paper,sheettype,fileBindingDigest:stockBindingDigest(stockFileBinding(files,proof))}};
    const f = countingFetch();
    await createVendorClient({env:ENABLED,fetchImpl:f}).submitOrder(boundOrder,files);
    assert.equal(JSON.parse(f.calls[0].init.body).sheettype,sheettype);
    const bad = countingFetch();
    await assert.rejects(createVendorClient({env:ENABLED,fetchImpl:bad}).submitOrder(boundOrder,{...files,proof:{...proof,paper:'standard'}}), {code:'vendor_rejected'});
    assert.equal(bad.calls.length,0);
  }
});

test('legacy v1 snapshot maps only its implicit standard product', async () => {
  const f = countingFetch();
  const quote = {verified:true,priceVersion:'2026-11-08.v1',presetId:'square-220',pageCount:24};
  const c = createVendorClient({env:ENABLED,fetchImpl:f});
  await c.submitOrder({...order,quote},UPLOADED);
  assert.equal(JSON.parse(f.calls[0].init.body).sheettype,'wood-free-white-110');
  const bad = countingFetch();
  await assert.rejects(createVendorClient({env:ENABLED,fetchImpl:bad}).submitOrder({...order,quote:{...quote,paper:'chrome-matte-130'}},UPLOADED),{code:'vendor_rejected'});
  assert.equal(bad.calls.length,0);
});

test('different object URI with same declared hashes never reaches network', async () => {
  const paper = 'chrome-matte-170';
  const proof = {version:1,paper,presetId:'square-220',pageCount:24,cover:'softcover',contentSha256:'a'.repeat(64),coverSha256:'b'.repeat(64),contentUri:'gs://bucket/content.pdf',coverUri:'gs://bucket/cover.pdf',contentGeneration:'101',coverGeneration:'102'};
  const boundOrder = {...order,quote:{...order.quote,paper,sheettype:'chromo-mat-170',fileBindingDigest:stockBindingDigest(stockFileBinding({...UPLOADED,proof},proof))}};
  for (const files of [
    {...UPLOADED,contentUrl:'gs://bucket/other.pdf',proof},
    {...UPLOADED,contentUrl:'gs://bucket/other.pdf',proof:{...proof,contentUri:'gs://bucket/other.pdf'}},
  ]) {
    const f = countingFetch();
    await assert.rejects(createVendorClient({env:ENABLED,fetchImpl:f}).submitOrder(boundOrder,files),{code:'vendor_rejected'});
    assert.equal(f.calls.length,0);
  }
});

test('real adapter rejects missing or false verified status before network', async () => {
  for (const verified of [false, undefined]) {
    const f = countingFetch();
    const quote = {...order.quote};
    if (verified === undefined) delete quote.verified; else quote.verified = verified;
    assert.equal(await codeOf(createVendorClient({env:ENABLED,fetchImpl:f}).submitOrder({...order,quote},UPLOADED)), 'vendor_rejected');
    assert.equal(f.calls.length,0);
  }
});

test('enabled but not configured (no base url) -> vendor_not_configured, still no network', async () => {
  const f = countingFetch();
  const c = createVendorClient({ env: { BOOKPOD_ENABLED: 'true', BOOKPOD_API_KEY: 'k' }, fetchImpl: f });
  assert.equal(await codeOf(c.submitOrder(order, PRINT_FILES)), 'vendor_not_configured');
  assert.equal(f.calls.length, 0);
});

test('outcome classification: 4xx rejected (definite), 5xx and timeouts are UNKNOWN outcome', async () => {
  const mk = (status) => createVendorClient({ env: ENABLED, fetchImpl: countingFetch(async () => ({ ok: false, status, json: async () => ({}) })) });
  const rej = await mk(422).submitOrder(order, UPLOADED).catch((e) => e);
  assert.deepEqual([rej.code, rej.unknownOutcome], ['vendor_rejected', false]);
  const five = await mk(503).submitOrder(order, UPLOADED).catch((e) => e);
  assert.deepEqual([five.code, five.unknownOutcome], ['vendor_unknown', true]);
  const abort = createVendorClient({ env: ENABLED, fetchImpl: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; } });
  const t = await abort.submitOrder(order, UPLOADED).catch((e) => e);
  assert.deepEqual([t.code, t.unknownOutcome], ['vendor_timeout', true]);
  const net = createVendorClient({ env: ENABLED, fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal((await net.submitOrder(order, UPLOADED).catch((e) => e)).unknownOutcome, true);
  // missing files never reach the network
  const f = countingFetch();
  assert.equal(await codeOf(createVendorClient({ env: ENABLED, fetchImpl: f }).submitOrder(order, null)), 'vendor_rejected');
  assert.equal(f.calls.length, 0);
});

test('mock vendor is scriptable and records calls', async () => {
  const v = createMockVendor(['timeout', 'reject', 'success']);
  assert.equal(await codeOf(v.submitOrder(order, PRINT_FILES)), 'vendor_timeout');
  assert.equal(await codeOf(v.submitOrder(order, PRINT_FILES)), 'vendor_rejected');
  assert.deepEqual(await v.submitOrder(order, PRINT_FILES), { ref: 'mock-ref-1' });
  assert.equal(v.calls.length, 3);
  assert.ok(new VendorError('x', 'y', { unknownOutcome: true }).unknownOutcome);
});

test('creem adapter: request shape per contract (base url, product, custom_price, request_id, metadata)', async () => {
  const f = countingFetch(async () => ({ ok: true, status: 200, json: async () => ({ id: 'ch_1', checkout_url: 'https://pay.test/c/1' }) }));
  const env = { CREEM_API_KEY: 'key', CREEM_PRINT_PRODUCT_ID: 'prod_print', CREEM_TEST_MODE: 'true' };
  const p = createCreemPayment({ env, fetchImpl: f });
  const out = await p.createCheckout({ id: 'order-uuid', total_agorot: 10800 });
  assert.deepEqual(out, { url: 'https://pay.test/c/1', ref: 'ch_1' });
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://test-api.creem.io/v1/checkouts');
  assert.equal(init.headers['x-api-key'], 'key');
  assert.deepEqual(JSON.parse(init.body), {
    product_id: 'prod_print', units: 1, custom_price: 10800, request_id: 'order-uuid',
    metadata: { order_id: 'order-uuid' }, success_url: `https://sipurai.ai/orders?paid=1&order=order-uuid`,
  });
  assert.equal(creemApiBase({}), 'https://api.creem.io');
  assert.equal(creemApiBase({ CREEM_API_BASE: 'https://x.test/' }), 'https://x.test');
  // not configured / provider errors surface as PaymentError, never a silent success
  assert.equal(await codeOf(createCreemPayment({ env: {}, fetchImpl: f }).createCheckout({ id: 'a', total_agorot: 1 })), 'payment_not_configured');
  const bad = createCreemPayment({ env, fetchImpl: countingFetch(async () => ({ ok: false, status: 400, json: async () => ({}) })) });
  assert.equal(await codeOf(bad.createCheckout({ id: 'a', total_agorot: 1 })), 'payment_rejected');
  assert.ok(new PaymentError('x') instanceof Error);
});
