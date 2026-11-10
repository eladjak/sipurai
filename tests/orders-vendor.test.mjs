import test from 'node:test';
import assert from 'node:assert/strict';
import { createVendorClient, isVendorEnabled, VendorError } from '../api/_lib/bookpod/client.js';
import { createMockVendor } from '../api/_lib/bookpod/mock.js';
import { createCreemPayment, creemApiBase, PaymentError } from '../api/_lib/orders/payment/creem.js';
import { PRINT_FILES } from './orders-helpers.mjs';

const order = { id: 'o-1', qty: 2, method: 'ship', address: { fullName: 'x' }, quote: { bookTitle: 'T' } };
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

test('enabled but not configured (no base url) -> vendor_not_configured, still no network', async () => {
  const f = countingFetch();
  const c = createVendorClient({ env: { BOOKPOD_ENABLED: 'true', BOOKPOD_API_TOKEN: 'k' }, fetchImpl: f });
  assert.equal(await codeOf(c.submitOrder(order, PRINT_FILES)), 'vendor_not_configured');
  assert.equal(f.calls.length, 0);
});

// The enabled-path behaviour of the vendor client (official API flow, outcome classes) is covered in
// tests/bookpod-official-api.test.mjs.

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
