import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_PRESETS, getPrintGeometry, getVerifiedSpineMm, printPrice } from '../src/lib/printSpec.js';

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
