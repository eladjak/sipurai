import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuote, PRICE_VERSION, PricingError, vatIncludedAgorot,
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

test('unquoted combinations fail closed even with legacy estimate flag', () => {
  const env = { PRINT_ALLOW_UNVERIFIED_SIZES: 'true' };
  for (const input of [{paper:'chrome-matte-130'}, {paper:'chrome-matte-170'}])
    assert.equal(code(() => computeQuote({...base, ...input}, {env})), 'price_unavailable');
  const estimated = computeQuote({...base, presetId:'square-200'}, {env});
  assert.equal(estimated.verified, false);
  assert.equal(estimated.totalAgorot, 10800);
  assert.equal(code(() => computeQuote({...base, presetId:'square-200'})), 'size_not_available');
  assert.equal(code(() => computeQuote({...base, paper:'premium'})), 'invalid_paper');
  for (const paper of [null, ['standard'], {}, 42]) assert.equal(code(() => computeQuote({...base, paper})), 'invalid_paper');
  assert.equal(code(() => computeQuote(base, {env:{PRINT_MARGIN_AGOROT:'9007199254740991'}})), 'config_invalid');
  assert.equal(code(() => computeQuote(base, {env:{PRINT_MAX_QTY:'9007199254740991'}})), 'config_invalid');
  assert.equal(code(() => computeQuote({...base, cover:'hardcover'}, {env:{PRINT_HARDCOVER_ENABLED:'true'}})), 'cover_not_available');
});

test('specific verified configuration keeps stock, price and source in snapshot', () => {
  const entry = {presetId:'square-220', pageCount:24, paper:'chrome-matte-130', cover:'softcover', costAgorot:3000, quoteRef:'fixture'};
  const env = {PRINT_VERIFIED_QUOTES_JSON: JSON.stringify([entry])};
  const q = computeQuote({...base, paper:entry.paper}, {env});
  assert.equal(q.unitAgorot, 8500);
  assert.equal(q.sheettype, 'chromo-mat-130');
  assert.equal(q.paper, entry.paper);
  assert.equal(q.quoteRef, 'fixture');
  assert.equal(code(() => computeQuote({...base, paper:'chrome-matte-170'}, {env})), 'price_unavailable');
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
