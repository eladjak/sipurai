import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_PRESETS, getPrintGeometry, getVerifiedSpineMm, printPrice, getSpine, printPageCountFor, isSupportedPageCount, SPINE_24PP_DOC_DISCREPANT_MM } from '../src/lib/printSpec.js';

test('offers exactly the three requested trim sizes', () => {
  assert.deepEqual(PRINT_PRESETS.map(({ widthMm, heightMm }) => [widthMm, heightMm]), [[220, 220], [200, 200], [165, 235]]);
});

test('content geometry includes 3.2mm bleed and 10mm safety inset', () => {
  const geometry = getPrintGeometry('square-220');
  assert.deepEqual(geometry.content, { widthMm: 226.4, heightMm: 226.4 });
  assert.deepEqual(geometry.safe, { xMm: 13.2, yMm: 13.2, widthMm: 200, heightMm: 200 });
  assert.deepEqual(getPrintGeometry('portrait-165x235').content, { widthMm: 171.4, heightMm: 241.4 });
});

test('spine and price are known only for the exact proof specification', () => {
  const proof = { presetId: 'square-220', pageCount: 24, paper: 'white-110gsm', cover: 'soft-matte' };
  assert.equal(getVerifiedSpineMm(proof), 1.8);
  assert.deepEqual(printPrice(proof), { amount: 20.9, currency: 'ILS', vatIncluded: false });
  for (const change of [{ pageCount: 32 }, { presetId: 'square-200' }, { paper: 'other' }, { cover: 'other' }]) {
    assert.equal(getVerifiedSpineMm({ ...proof, ...change }), null);
    assert.equal(printPrice({ ...proof, ...change }), null);
  }
});

test('unknown preset fails closed', () => {
  assert.throws(() => getPrintGeometry('unknown'), /Unknown print preset/);
});

test('generation ratio follows selected size and preserves legacy books', async () => {
  const { imageAspectForBook } = await import('../src/lib/printSpec.js');
  assert.equal(imageAspectForBook({ print_size: 'portrait-165x235' }), '2:3');
  assert.equal(imageAspectForBook({ print_size: 'square-220' }), '1:1');
  assert.equal(imageAspectForBook({}), '1:1');
});

test('existing illustrated books cannot silently change aspect', async () => {
  const { canChangePrintSize } = await import('../src/lib/printSpec.js');
  assert.equal(canChangePrintSize({ print_size: 'square-220', cover_image: 'cover' }, [], 'portrait-165x235'), false);
  assert.equal(canChangePrintSize({}, [{ image_url: 'page' }], 'portrait-165x235'), false);
  assert.equal(canChangePrintSize({}, [], 'portrait-165x235'), true);
  assert.equal(canChangePrintSize({ cover_image: 'cover' }, [], 'square-200'), true);
});

test('spine: exactly 1.8 for 24pp (measured), linear 0.15mm per sheet otherwise, null outside the verified paper', () => {
  const base = { presetId: 'square-220', pageCount: 24, paper: 'white-110gsm', cover: 'soft-matte' };
  assert.deepEqual(getSpine(base), { mm: 1.8, source: 'measured-proof-24pp', verified: true });
  assert.deepEqual(getSpine({ ...base, presetId: 'square-200' }), { mm: 1.8, source: 'derived-linear', verified: false });
  assert.deepEqual(getSpine({ ...base, pageCount: 40 }), { mm: 3, source: 'derived-linear', verified: false });
  assert.deepEqual(getSpine({ ...base, pageCount: 80 }), { mm: 6, source: 'derived-linear', verified: false });
  assert.equal(getSpine({ ...base, paper: 'x' }), null);
  assert.equal(getSpine({ ...base, cover: 'x' }), null);
  assert.equal(getSpine({ ...base, presetId: 'nope' }), null);
  for (const pageCount of [22, 23, 25, 82, 0, -24, 24.5, '24', null]) assert.equal(getSpine({ ...base, pageCount }), null);
  assert.notEqual(getSpine(base).mm, SPINE_24PP_DOC_DISCREPANT_MM); // 1.65 is the documented-but-unused value
});

test('page counts: even, 24..80; story lengths 6/10/15 pad to 24', () => {
  assert.equal(isSupportedPageCount(24), true);
  assert.equal(isSupportedPageCount(80), true);
  assert.equal(isSupportedPageCount(26), true);
  assert.equal(isSupportedPageCount(22), false);
  assert.equal(isSupportedPageCount(81), false);
  assert.equal(isSupportedPageCount(82), false);
  for (const n of [6, 10, 15]) assert.equal(printPageCountFor(n), 24);
  assert.equal(printPageCountFor(25), 26);
  assert.equal(printPageCountFor(80), 80);
  assert.throws(() => printPageCountFor(81), /Unsupported/);
  assert.throws(() => printPageCountFor(0), /Invalid/);
});
