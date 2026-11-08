import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { createInteriorPdf, createCoverPdf, buildPrintPackage } from '../src/utils/printExporter.js';

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
const art = (n = 24) => Array(n).fill(adequate);
const boxes = (doc) => [...doc.output().matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]) * 25.4 / 72, Number(m[2]) * 25.4 / 72]);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);

const TRIMS = [['square-220', 220, 220], ['square-200', 200, 200], ['portrait-165x235', 165, 235]];
// Independent oracle: expected sizes from first principles, bleed passed in so it can be sabotaged.
const expectedInterior = (w, h, bleed = 3.2) => [w + 2 * bleed, h + 2 * bleed];
const expectedCover = (w, h, pages, bleed = 3.2) => [2 * w + (pages / 2) * 0.15 + 2 * bleed, h + 2 * bleed];

test('interior PDF has the right page count and exact bleed size for every trim and page count', () => {
  for (const [presetId, w, h] of TRIMS) for (const pageCount of [24, 40]) {
    const doc = createInteriorPdf({ ...spec, presetId, pageCount }, art(pageCount));
    const pages = boxes(doc); assert.equal(pages.length, pageCount);
    const [ew, eh] = expectedInterior(w, h);
    for (const [pw, ph] of pages) { near(pw, ew); near(ph, eh); }
  }
});
test('cover is one spread of exact size for every trim and page count', () => {
  for (const [presetId, w, h] of TRIMS) for (const pageCount of [24, 40]) {
    const doc = createCoverPdf({ ...spec, presetId, pageCount }, { front: adequate, back: adequate });
    const b = boxes(doc); assert.equal(b.length, 1);
    const [ew, eh] = expectedCover(w, h, pageCount);
    near(b[0][0], ew); near(b[0][1], eh);
  }
  near(boxes(createCoverPdf(spec, { front: adequate, back: adequate }))[0][0], 448.2);
});
test('RTL cover: back on the left, front on the right, nothing on the spine', () => {
  const doc = createCoverPdf(spec, { front: adequate, back: adequate });
  const operations = doc.internal.pages[1].join('\n');
  const placements = [...operations.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/g)].map(m => m.slice(1).map(Number).map(n => n * 25.4 / 72));
  assert.equal(placements.length, 2);
  for (const [width, height, , y] of placements) { near(width, 200); near(height, 200); near(y, 13.2); }
  const spine = 1.8;
  near(placements[0][2], 13.2);                 // back, left
  near(placements[1][2], 13.2 + 220 + spine);   // front, right
  assert.ok(placements[1][2] > 3.2 + 220 + spine, 'front starts right of the spine');
  assert.equal((operations.match(/ Do/g) || []).length, 2);
});
test('MUTATION CONTROL: the size assertions discriminate a 3.0mm bleed from 3.2mm', () => {
  const doc = createCoverPdf(spec, { front: adequate, back: adequate });
  const [[w, h]] = boxes(doc);
  const [wrongW, wrongH] = expectedCover(220, 220, 24, 3.0);
  assert.ok(Math.abs(w - wrongW) > 0.01 && Math.abs(h - wrongH) > 0.01, 'wrong-bleed oracle must disagree with real output');
  assert.throws(() => near(w, wrongW));
  const [iw] = boxes(createInteriorPdf(spec, art()))[0];
  assert.throws(() => near(iw, expectedInterior(220, 220, 3.0)[0]));
});
test('buildPrintPackage returns both PDFs and matching meta', () => {
  for (const [presetId, w, h] of TRIMS) for (const pageCount of [24, 32]) {
    const pkg = buildPrintPackage({ ...spec, presetId, pageCount }, { pages: art(pageCount), front: adequate, back: adequate });
    assert.equal(boxes(pkg.interior).length, pageCount);
    assert.equal(boxes(pkg.cover).length, 1);
    const [ew, eh] = expectedInterior(w, h), [cw, ch] = expectedCover(w, h, pageCount);
    near(pkg.meta.interiorPageSizeMm.widthMm, ew); near(pkg.meta.interiorPageSizeMm.heightMm, eh);
    near(pkg.meta.coverSizeMm.widthMm, cw); near(pkg.meta.coverSizeMm.heightMm, ch);
    near(pkg.meta.spineMm, (pageCount / 2) * 0.15); assert.equal(pkg.meta.pageCount, pageCount);
    near(boxes(pkg.cover)[0][0], pkg.meta.coverSizeMm.widthMm);
  }
});
test('rejects low resolution, missing pages and unverified paper specifications', () => {
  assert.throws(() => createInteriorPdf(spec, Array(24).fill(small)), /300 dpi/i);
  assert.throws(() => createCoverPdf(spec, { front: small, back: adequate }), /300 dpi/i);
  assert.throws(() => createInteriorPdf(spec, art().slice(1)), /24/);
  assert.throws(() => createInteriorPdf({ ...spec, pageCount: 32 }, art(24)), /32/);
  assert.throws(() => createInteriorPdf({ ...spec, paper: 'other' }, art()), /specification/i);
  for (const pageCount of [22, 23, 82, 0, 24.5, '24']) {
    assert.throws(() => createCoverPdf({ ...spec, pageCount }, { front: adequate, back: adequate }), /specification/i);
    assert.throws(() => buildPrintPackage({ ...spec, pageCount }, { pages: art(24), front: adequate, back: adequate }), /specification/i);
  }
  assert.throws(() => createCoverPdf({ ...spec, cover: 'hard' }, { front: adequate, back: adequate }), /specification/i);
});
