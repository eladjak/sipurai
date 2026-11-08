import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { createInteriorPdf, createCoverPdf } from '../src/utils/printExporter.js';

// A real, compressed PNG with explicitly controlled pixel dimensions.
function png(width, height) {
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (name, data) => { const type = Buffer.from(name); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([type, data]))); return Buffer.concat([len, type, data, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height, 180); for (let y = 0; y < height; y++) raw[y * (width * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const adequate = png(3000, 3000);
const small = png(200, 200);
const spec = { presetId: 'square-220', pageCount: 24, paper: 'white-110gsm', cover: 'soft-matte' };
const art = () => Array(24).fill(adequate);
const boxes = (doc) => [...doc.output().matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]) * 25.4 / 72, Number(m[2]) * 25.4 / 72]);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);

test('interior PDF has 24 actual pages with bleed dimensions for each trim', () => {
  for (const [presetId, width, height] of [['square-220',226.4,226.4], ['square-200',206.4,206.4], ['portrait-165x235',171.4,241.4]]) {
    const doc = createInteriorPdf({ ...spec, presetId }, art());
    const pages = boxes(doc); assert.equal(pages.length, 24);
    for (const [w,h] of pages) { near(w,width); near(h,height); }
  }
});
test('cover is a single RTL spread with front on left and verified spine only', () => {
  const doc = createCoverPdf(spec, { front: adequate, back: adequate });
  const coverBoxes = boxes(doc); assert.equal(coverBoxes.length, 1);
  const [[w,h]] = coverBoxes; near(w, 448.2); near(h, 226.4);
  const operations = doc.internal.pages[1].join('\n');
  const placements = [...operations.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/g)].map(m => m.slice(1).map(Number).map(n => n * 25.4 / 72));
  assert.equal(placements.length, 2);
  for (const [width, height, x, y] of placements) { near(width, 200); near(height, 200); near(y, 13.2); assert.ok(x >= 13.19); }
  near(placements[0][2], 13.2); near(placements[1][2], 235);
  const content = doc.output();
  assert.ok(content.indexOf('/I0 Do') < content.indexOf('/I1 Do'));
  assert.equal((content.match(/ Do/g) || []).length, 2);
  for (const presetId of ['square-200','portrait-165x235']) assert.throws(() => createCoverPdf({ ...spec, presetId }, { front: adequate, back: adequate }), /spine/i);
});
test('rejects low resolution, missing pages and unverified paper specifications', () => {
  assert.throws(() => createInteriorPdf(spec, Array(24).fill(small)), /300 dpi/i);
  assert.throws(() => createCoverPdf(spec, { front: small, back: adequate }), /300 dpi/i);
  assert.throws(() => createInteriorPdf(spec, art().slice(1)), /24/);
  assert.throws(() => createInteriorPdf({ ...spec, paper: 'other' }, art()), /specification/i);
  assert.throws(() => createCoverPdf({ ...spec, pageCount: 32 }, { front: adequate, back: adequate }), /spine/i);
});
