import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canApproveNikud, createEditionManifest, editionDraft, isReviewCurrent, matterReview, pageDraft, printReviewComplete, stripNikud } from '../src/lib/printEdition/model.js';

import { fitDedication } from '../src/lib/printEdition/dedicationLayout.js';

it('balances dedication lines inside the same text area without a one-word widow', () => {
  const layout = fitDedication('״לך איתך הספר פתוח תמיד ואפשר לקרוא ביחד שוב״', (text, points) => text.length * points / 3);
  assert.ok(layout);
  assert.ok(layout.text.split('\n').length > 1);
  assert.ok(layout.text.split('\n').slice(1).every(line => line.includes(' ')));
  assert.equal(fitDedication('ל'.repeat(160), (text, points) => text.length * points / 3), null);
});

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

  it('normalizes line endings and blocks unsafe directional controls', () => {
    assert.equal(canApproveNikud({ source: 'שלום\nעולם!', text: 'שָׁלוֹם\r\nעוֹלָם!' }), true);
    const edition = example();
    edition.blurb = '\u202eטקסט';
    assert.throws(() => createEditionManifest(book, pages, edition, path => path), /Unsupported bidi controls/);
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

  it('requires separate approval for pointed cover, dedication and other non-story text', () => {
    const edition = example();
    const titling = { ...book, title: 'סֵפֶר' };
    edition.pages.p1.text = edition.pages.p1.source;
    edition.pages.p1.approval = { mode: 'unpointed', text: edition.pages.p1.source };
    assert.throws(() => createEditionManifest(titling, pages, edition, p => p), /review is incomplete/);
    edition.matterApproval = matterReview(edition, titling).snapshot;
    assert.equal(createEditionManifest(titling, pages, edition, p => p).nikudStatus, 'approved');
    edition.dedication = 'לְךָ.';
    assert.throws(() => createEditionManifest(titling, pages, edition, p => p), /review is incomplete/);
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
    assert.deepEqual(manifest.requestedFinishing, { cover: 'hardcover', paper: 'premium' });
    assert.equal(manifest.nikudStatus, 'approved');
    assert.deepEqual(manifest.scenes, [{
      layout: 'spread', art: 'wide.png', text: [pointed, 'איך הולך?'],
      zones: ['bottom-right', 'top-left'], pointing: ['approved', 'unpointed'],
    }]);
    assert.equal(manifest.closingArt, 'ending.png');
  });

  it('reopens imported artwork and keeps framing across zone edits and layout toggles', () => {
    const edition = example();
    edition.printTitle = 'סֵפֶר הַמִּשְׁפָּחָה';
    edition.copyright = 'טקסט מקור.\nכל הזכויות שמורות.';
    edition.pages.p1.printArt = 'uncropped-single.jpg';
    edition.pages.p1.printSettings = { anchor: [0.73, 0.36], panel: 'dark', panelWidthsMm: [81, 99] };
    edition.matterApproval = matterReview(edition, book).snapshot;
    const reopened = editionDraft(JSON.parse(JSON.stringify(edition)));
    const draft = pageDraft(reopened, pages[0], 0);
    reopened.pages.p1 = { ...draft, zone: 'top-right' };
    reopened.pages.p2 = { ...pageDraft(reopened, pages[1], 1), zone: 'bottom-left' };

    const render = () => createEditionManifest(book, pages, reopened, path => path);
    let manifest = render();
    assert.equal(manifest.title, edition.printTitle);
    assert.equal(manifest.copyright, edition.copyright);
    assert.equal(manifest.scenes[0].art, 'wide.png');
    assert.deepEqual(manifest.scenes[0].anchor, [0.73, 0.36]);
    assert.equal(manifest.scenes[0].panel, 'dark');
    assert.deepEqual(manifest.scenes[0].panelWidthsMm, [81, 99]);
    assert.deepEqual(manifest.scenes[0].zones, ['top-right', 'bottom-left']);

    reopened.pages.p1.layout = 'single';
    manifest = render();
    assert.equal(manifest.scenes[0].art, 'uncropped-single.jpg');
    assert.equal(manifest.scenes[0].panelWidthsMm, undefined);
    reopened.pages.p1.layout = 'spread';
    assert.equal(render().scenes[0].art, 'wide.png');
    assert.deepEqual(render().scenes[0].panelWidthsMm, [81, 99]);

    reopened.printTitle += '!';
    assert.throws(render, /review is incomplete/);
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
