import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuote, PRICE_VERSION, PricingError, PRINT_PRODUCTS, vatIncludedAgorot,
} from '../src/lib/printOrder/pricing.js';

const base = { presetId: 'square-220', pageCount: 24, qty: 1, method: 'ship' };
const code = (fn) => { try { fn(); } catch (e) { return e instanceof PricingError ? e.code : `other:${e.message}`; } return 'no-error'; };

test('verified 22x22/24pp, 1 copy, shipped: exactly 108.00 ILS', () => {
  const q = computeQuote(base);
  assert.equal(q.totalAgorot, 10800);
  assert.deepEqual(q.lines.map((l) => [l.key, l.amountAgorot]), [['book', 7900], ['shipping', 2900]]);
  assert.equal(q.lines[1].label_he, 'משלוח סיפוראי');
  assert.equal(q.vatIncluded, true);
  assert.equal(q.vatAgorot, 1647); // round(10800 * 18 / 118)
  assert.equal(q.priceVersion, PRICE_VERSION);
  assert.equal(q.verified, true);
  assert.equal(q.currency, 'ILS');
});

test('quantity multiplies the book line, shipping is once per order', () => {
  const q = computeQuote({ ...base, qty: 3 });
  assert.deepEqual(q.lines.map((l) => l.amountAgorot), [23700, 2900]);
  assert.equal(q.totalAgorot, 26600);
  assert.equal(q.lines[0].label_he, 'ספר מודפס × 3');
});

test('pickup: shipping line is 0, label is pickup, only when enabled', () => {
  const env = { PRINT_PICKUP_ENABLED: 'true' };
  const q = computeQuote({ ...base, qty: 2, method: 'pickup' }, { env });
  assert.equal(q.totalAgorot, 15800);
  assert.deepEqual(q.lines[1], { key: 'shipping', label_he: 'איסוף עצמי', amountAgorot: 0 });
  assert.equal(code(() => computeQuote({ ...base, method: 'pickup' })), 'pickup_not_available');
});

test('final unit price is rounded UP to whole shekels', () => {
  assert.equal(computeQuote(base, { env: { PRINT_MARGIN_AGOROT: '0' } }).lines[0].amountAgorot, 2500); // 24.66 -> 25
  assert.equal(computeQuote(base, { env: { PRINT_MARGIN_AGOROT: '100' } }).lines[0].amountAgorot, 2600); // 25.66 -> 26
  assert.equal(computeQuote(base, { env: { PRINT_MARGIN_AGOROT: '5434' } }).lines[0].amountAgorot, 7900); // exactly 79.00
});

test('shipping and margin are configurable; garbage config fails closed', () => {
  assert.equal(computeQuote(base, { env: { PRINT_SHIP_AGOROT: '3500' } }).totalAgorot, 11400);
  assert.equal(code(() => computeQuote(base, { env: { PRINT_MARGIN_AGOROT: 'abc' } })), 'config_invalid');
  assert.equal(code(() => computeQuote(base, { env: { PRINT_SHIP_AGOROT: '-5' } })), 'config_invalid');
});

test('only 22x22/24pp is verified; other sizes are blocked unless PRINT_ALLOW_UNVERIFIED_SIZES=true', () => {
  assert.equal(PRINT_PRODUCTS.filter((p) => p.verified).length, 1);
  assert.equal(code(() => computeQuote({ ...base, presetId: 'square-200' })), 'size_not_available');
  assert.equal(code(() => computeQuote({ ...base, presetId: 'portrait-165x235' })), 'size_not_available');
  const env = { PRINT_ALLOW_UNVERIFIED_SIZES: 'true' };
  const q = computeQuote({ ...base, presetId: 'square-200' }, { env });
  assert.equal(q.verified, false);
  assert.equal(q.lines[0].amountAgorot, 7800); // ceil(23.00 + 54.34) = 78
  // same size, different page count: also unverified
  assert.equal(code(() => computeQuote({ ...base, pageCount: 28 })), 'size_not_available');
  assert.equal(computeQuote({ ...base, pageCount: 28 }, { env }).lines[0].amountAgorot, 8200);
});

test('input validation', () => {
  assert.equal(code(() => computeQuote({ ...base, presetId: 'nope' })), 'unknown_preset');
  assert.equal(code(() => computeQuote({ ...base, qty: 0 })), 'invalid_qty');
  assert.equal(code(() => computeQuote({ ...base, qty: 1.5 })), 'invalid_qty');
  assert.equal(code(() => computeQuote({ ...base, qty: 11 })), 'invalid_qty');
  assert.equal(computeQuote({ ...base, qty: 11 }, { env: { PRINT_MAX_QTY: '20' } }).qty, 11);
  assert.equal(code(() => computeQuote({ ...base, method: 'drone' })), 'invalid_method');
  assert.equal(code(() => computeQuote({ ...base, pageCount: 25 })), 'invalid_page_count');
});

test('money is always an integer number of agorot', () => {
  for (const qty of [1, 2, 3, 7, 10]) {
    const q = computeQuote({ ...base, qty });
    for (const l of q.lines) assert.ok(Number.isInteger(l.amountAgorot));
    assert.ok(Number.isInteger(q.totalAgorot) && Number.isInteger(q.vatAgorot));
  }
  assert.equal(vatIncludedAgorot(11800), 1800);
});

test('CONTROL: a wrong expectation is reported red (the assertions can fail)', () => {
  assert.throws(() => assert.equal(computeQuote(base).totalAgorot, 10801));
});
