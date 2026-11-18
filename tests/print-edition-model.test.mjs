import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canApproveNikud, createEditionManifest, editionDraft, isReviewCurrent, pageDraft, printReviewComplete, stripNikud } from '../src/lib/printEdition/model.js';

const book = {
  id: '12345678-1234-1234-1234-123456789012',
  language: 'hebrew',
  title: 'ספר',
  cover_image: 'cover.png',
};
const pages = [
  { id: 'p1', text_content: 'שלום עולם!', image_url: 'story.png' },
  { id: 'p2', text_content: 'איך הולך?', image_url: 'story.png' },
];
const pointed = 'שָׁלוֹם עוֹלָם!';

function example() {
  const edition = editionDraft();
  edition.creator = 'סופר';
  edition.blurb = 'תיאור הסיפור';
  edition.cover = 'hardcover';
  edition.paper = 'premium';
  edition.pages.p1 = { source: 'שלום עולם!', text: pointed, approval: { mode: 'approved', text: pointed }, layout: 'spread', spread: 'wide.png', zone: 'bottom-right' };
  edition.pages.p2 = { source: 'איך הולך?', text: 'איך הולך?', approval: { mode: 'unpointed', text: 'איך הולך?' } };
  edition.artwork.closingArt = 'ending.png';
  return edition;
}

describe('owner print-edition review', () => {
  it('preserves Hebrew punctuation and refuses letter or punctuation changes', () => {
    assert.equal(stripNikud('״' + pointed + '״'), '״שלום עולם!״');
    assert.equal(canApproveNikud({ source: 'שלום עולם!', text: pointed }), true);
    assert.equal(canApproveNikud({ source: 'שלום עולם!', text: pointed.replace('!', '?') }), false);
  });

  it('accepts the Academy’s distinct fully pointed form of the same word', () => {
    assert.equal(canApproveNikud({ source: 'קובייה', text: 'קֻבִּיָּה' }), true);
    assert.equal(canApproveNikud({ source: 'הקובייה.', text: 'הַקֻּבִּיָּה.' }), true);
    assert.equal(canApproveNikud({ source: 'קובייה', text: 'קַבִּיָּה' }), false);
    assert.equal(canApproveNikud({ source: 'קובייה', text: 'קֻבִּיָּת' }), false);
    assert.equal(canApproveNikud({ source: 'לקובייה', text: 'לַקֻּבִּיָּה' }), false);
  });

  it('invalidates approval both on changed source and changed candidate', () => {
    const edition = example();
    assert.equal(isReviewCurrent(pageDraft(edition, pages[0], 0)), true);
    edition.pages.p1.text = pointed.replace('ָ', 'ַ');
    assert.equal(isReviewCurrent(pageDraft(edition, pages[0], 0)), false);
    assert.equal(printReviewComplete(edition, book, pages), false);
    assert.throws(() => createEditionManifest(book, pages, edition, path => path), /review is incomplete/);
    edition.pages.p1.text = pointed;
    assert.equal(isReviewCurrent(pageDraft(edition, { ...pages[0], text_content: 'שלום לכולם!' }, 0)), false);
  });

  it('passes one continuous landscape asset and both reviewed texts to the prepress renderer', () => {
    const edition = example();
    const manifest = createEditionManifest(book, pages, edition, path => {
      assert.ok(path);
      return path;
    });
    assert.equal(manifest.qrUrl, 'https://www.sipurai.ai/b/print/' + book.id);
    assert.equal(manifest.binding, 'soft-matte');
    assert.equal(manifest.paper, 'white-110gsm');
    assert.equal(manifest.nikudStatus, 'approved');
    assert.deepEqual(manifest.scenes, [{
      layout: 'spread', art: 'wide.png', text: [pointed, 'איך הולך?'],
      zones: ['bottom-right', 'top-left'], pointing: ['approved', 'unpointed'],
    }]);
    assert.equal(manifest.closingArt, 'ending.png');
  });

  it('rejects overlapping spreads, unsupported trims and a missing independent closing illustration', () => {
    const edition = example();
    edition.pages.p2.layout = 'spread';
    const asset = path => { if (!path) throw new Error('Missing artwork'); return path; };
    assert.throws(() => createEditionManifest(book, pages, edition, asset), /Overlapping/);
    edition.pages.p2.layout = 'single';
    assert.throws(() => createEditionManifest({ ...book, print_size: 'portrait-165x235' }, pages, edition, asset), /22/);
    delete edition.artwork.closingArt;
    assert.throws(() => createEditionManifest(book, pages, edition, asset), /Missing artwork/);
  });
});
