import assert from 'node:assert/strict';
import test from 'node:test';
import { proofEditTarget, proofLeaves } from '../src/screens/print-edition/proof-viewer-model.js';

const proof = {
  coverUrl: '/cover-wrap.png',
  insideUrl: '/cover-inside.png',
  trimWidthMm: 220,
  trimHeightMm: 220,
  bleedMm: 3.2,
  spineMm: 1.8,
  pages: [
    { kind: 'title' },
    { kind: 'dedication' },
    { kind: 'copyright' },
    { kind: 'story', storyIndex: 0, text: 'טקסט הסיפור' },
    { kind: 'story', storyIndex: 1 },
    { kind: 'closing' },
  ].map((page, index) => ({ ...page, url: `/page-${index + 1}.png` })),
};

test('RTL book ordering matches the PDF plan at the cover and both endpapers', () => {
  const [cover, opening, ...rest] = proofLeaves(proof);
  assert.deepEqual(cover.leaves.map(leaf => leaf.kind), ['front', 'spine', 'back']);
  assert.deepEqual(opening.leaves.map(leaf => leaf.kind), ['insideFront', 'title']);
  assert.deepEqual(rest.map(spread => spread.leaves.map(leaf => leaf.number ?? leaf.kind)), [
    [2, 3], [4, 5], [6, 'insideBack'],
  ]);
  // Interior leaves are in reading order (right to left). Inside front is cut
  // from the right of the wrap raster and inside back from its left.
  assert.equal(opening.leaves[0].trim.x, 225);
  assert.equal(rest.at(-1).leaves[1].trim.x, 3.2);
  assert.ok(cover.leaves.every(leaf => leaf.url === proof.coverUrl));
});

test('trim and bleed retain the position and size of printer-rendered pixels', () => {
  const [cover, opening] = proofLeaves(proof);
  const [front, spine, back] = cover.leaves;
  assert.equal(front.trim.x, 3.2);
  assert.equal(spine.trim.x, 223.2);
  assert.equal(back.trim.x, 225);
  assert.equal(cover.leaves.reduce((width, leaf) => width + leaf.full.width, 0), front.media.width);
  assert.deepEqual(opening.leaves[1].trim, { x: 3.2, y: 3.2, width: 220, height: 220 });
  assert.deepEqual(opening.leaves[1].full, { x: 0, y: 0, width: 226.4, height: 226.4 });
});

test('missing inside retains a gap while missing mandatory rasters reject the proof', () => {
  const withoutInside = proofLeaves({ ...proof, insideUrl: undefined });
  assert.equal(withoutInside[1].leaves[0].url, undefined);
  assert.equal(withoutInside.at(-1).leaves[1].url, undefined);
  assert.equal(proofLeaves({ ...proof, coverUrl: null }), null);
  assert.equal(proofLeaves({ ...proof, pages: proof.pages.slice(1) }), null);
  assert.equal(proofLeaves({ ...proof, trimWidthMm: undefined }), null);
});

test('story edit uses content index, while cover and matter target their own fields', () => {
  const leaves = proofLeaves(proof).flatMap(spread => spread.leaves);
  assert.deepEqual(proofEditTarget(leaves.find(leaf => leaf.storyIndex === 0)), { kind: 'story', storyIndex: 0, field: 'text' });
  assert.deepEqual(proofEditTarget(leaves.find(leaf => leaf.kind === 'back')), { kind: 'cover', field: 'blurb' });
  assert.deepEqual(proofEditTarget(leaves.find(leaf => leaf.kind === 'insideBack')), { kind: 'closing', field: 'closingArt' });
  assert.deepEqual(proofEditTarget(leaves.find(leaf => leaf.kind === 'insideFront')), { kind: 'endpaper', field: 'endpaperArt' });
  assert.deepEqual(proofEditTarget(leaves.find(leaf => leaf.kind === 'dedication')), { kind: 'dedication', field: 'dedication' });
  assert.equal(proofEditTarget({ kind: 'story', storyIndex: -1 }), null);
  assert.equal(proofEditTarget(leaves.find(leaf => leaf.kind === 'spine')), null);
});
