import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canApproveNikud, createDraftEditionManifest, createEditionManifest, editPageText, editionDraft, editionPhysicalPageCount, editionStoryPages, isReviewCurrent, matterReview, pageDraft, printReviewComplete, reviewSource, sameEditionSource, stripNikud } from '../src/lib/printEdition/model.js';

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
    edition.pages.p1.sourceParagraphs = ['שלום עולם!'];
    edition.pages.p1.printSettings = { anchor: [0.73, 0.36], panel: 'dark', panelWidthsMm: [81, 99] };
    edition.matterApproval = matterReview(edition, book).snapshot;
    const reopened = editionDraft(JSON.parse(JSON.stringify(edition)));
    const draft = pageDraft(reopened, pages[0], 0);
    reopened.pages.p1 = { ...draft, zone: 'top-right' };
    assert.deepEqual(reopened.pages.p1.sourceParagraphs, ['שלום עולם!']);
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

    reopened.pages.p1.printSettings.panel = 'integrated';
    assert.equal(createEditionManifest(book, pages, editionDraft(JSON.parse(JSON.stringify(reopened))), path => path).scenes[0].panel, 'integrated');

    reopened.printTitle += '!';
    assert.throws(render, /review is incomplete/);
  });

  it('applies new draft default per scene while preserving saved and explicit treatments', () => {
    const edition = example();
    edition.matterApproval = matterReview(edition, book).snapshot;
    const render = () => createEditionManifest(book, pages, edition, path => path);
    assert.equal(render().scenes[0].panel, undefined);
    edition.defaultPanel = 'integrated';
    assert.equal(render().scenes[0].panel, 'integrated');
    edition.pages.p1.printSettings = { panel: 'cream' };
    assert.equal(render().scenes[0].panel, 'cream');
    edition.pages.p1.printSettings.panel = 'dark';
    assert.equal(render().scenes[0].panel, 'dark');
  });

  it('rejects overlapping spreads, unsupported trims and a missing independent closing illustration', () => {
    const edition = example();
    edition.pages.p2.layout = 'spread';
    const asset = path => { if (!path) throw new Error('Missing artwork'); return path; };
    assert.throws(() => createEditionManifest(book, pages, edition, asset), /Overlapping/);
    edition.pages.p2.layout = 'single';
    assert.throws(() => createEditionManifest({ ...book, print_size: 'unsupported' }, pages, edition, asset), /Unsupported print size/);
    delete edition.artwork.closingArt;
    assert.throws(() => createEditionManifest(book, pages, edition, asset), /Missing artwork/);
  });
});

it('keeps print-only rewrites separate and requires approval for the exact rewritten text', () => {
  const edition = example();
  const prior = pageDraft(edition, pages[0], 0);
  const revision = 'שָׁלוֹם חָבֵר!';
  edition.pages.p1 = { ...prior, ...editPageText(prior, revision) };
  let actual = pageDraft(edition, pages[0], 0);
  assert.equal(pages[0].text_content, 'שלום עולם!');
  assert.equal(actual.source, 'שלום עולם!');
  assert.equal(reviewSource(actual), 'שלום חבר!');
  assert.equal(canApproveNikud(actual), true);
  assert.equal(isReviewCurrent(actual), false);
  assert.equal(createDraftEditionManifest(book, pages, edition, path => path).nikudStatus, 'pending');
  assert.throws(() => createEditionManifest(book, pages, edition, path => path), /incomplete/);
  edition.pages.p1.approval = { mode: 'approved', text: revision };
  actual = pageDraft(edition, pages[0], 0);
  assert.equal(isReviewCurrent(actual), true);
  const approved = createEditionManifest(book, pages, edition, path => path);
  const { missingInputs, ...preview } = createDraftEditionManifest(book, pages, edition, path => path);
  assert.deepEqual(missingInputs, []);
  assert.deepEqual(preview, approved);
  assert.equal(approved.scenes[0].text[0], revision);
  assert.equal(isReviewCurrent(pageDraft(edition, { ...pages[0], text_content: 'עדכון במקור' }, 0)), false);
});

it('keeps unpointed rewrites exact and never reuses stale unpointed approval on a new pointed display', () => {
  const edition = example();
  const prior = pageDraft(edition, pages[1], 1);
  const revised = 'הנה כל החברים.';
  edition.pages.p2 = { ...prior, ...editPageText(prior, revised), approval: { mode: 'unpointed', text: revised } };
  assert.equal(isReviewCurrent(pageDraft(edition, pages[1], 1)), true);
  assert.equal(createEditionManifest(book, pages, edition, path => path).scenes[0].text[1], revised);
  edition.pages.p2.text = 'הִנֵּה כל החברים.';
  assert.equal(isReviewCurrent(pageDraft(edition, pages[1], 1)), false);
  const pending = createDraftEditionManifest(book, pages, edition, path => path);
  assert.equal(pending.nikudStatus, 'pending');
  assert.equal(pending.scenes[0].pointing[1], 'pending');
  assert.equal(pending.scenes[0].text[1], edition.pages.p2.text);
});

it('reports absent inputs with readable draft text and never registers missing asset paths', () => {
  const edition = editionDraft();
  edition.pages.p1 = { ...pageDraft(edition, pages[0], 0), layout: 'spread' };
  const sources = [];
  const manifest = createDraftEditionManifest(book, pages, edition, src => { assert.ok(src); sources.push(src); return src; });
  assert.deepEqual(new Set(manifest.missingInputs), new Set(['creator', 'blurb', 'scene:0:spreadArt', 'closingArt']));
  assert.equal(manifest.scenes[0].art, null);
  assert.deepEqual(manifest.scenes[0].text, ['שלום עולם!', 'איך הולך?']);
  assert.ok(sources.every(src => src === book.cover_image));
  assert.throws(() => createEditionManifest(book, pages, edition, path => path), /incomplete/);
});

it('uses the selected native trim in both the preview and approved manifest', () => {
  const draft = createDraftEditionManifest({ ...book, print_size: 'portrait-165x235' }, pages, example(), path => path);
  assert.equal(draft.widthMm, 165);
  assert.equal(draft.heightMm, 235);
  assert.deepEqual(draft.missingInputs, []);
  const { missingInputs: _missing, ...preview } = draft;
  assert.deepEqual(preview, createEditionManifest({ ...book, print_size: 'portrait-165x235' }, pages, example(), path => path));
  const square = createEditionManifest({ ...book, print_size: 'square-200' }, pages, example(), path => path);
  assert.deepEqual([square.widthMm, square.heightMm], [200, 200]);
});


it('appends private print pages, keeps approval exact, and propagates selected story font', () => {
  const edition = example();
  const id = 'extra-12345678-1234-1234-1234-123456789012';
  edition.extraPages = [id];
  edition.storyFont = 'rubik';
  let all = editionStoryPages(edition, pages);
  assert.equal(pages.length, 2);
  assert.deepEqual(all[2], { id, page_number: 3, text_content: '', image_url: null, extra: true });
  let draft = createDraftEditionManifest(book, all, edition, path => path);
  assert.deepEqual(draft.missingInputs, ['scene:2:text', 'scene:2:art']);
  assert.equal(draft.storyFont, 'rubik');
  const extra = pageDraft(edition, all[2], 2);
  const words = 'סוף שמח.';
  edition.pages[id] = { ...extra, ...editPageText(extra, words), printArt: pages[0].image_url, approval: { mode: 'unpointed', text: words } };
  all = editionStoryPages(editionDraft(JSON.parse(JSON.stringify(edition))), pages);
  const manifest = createEditionManifest(book, all, edition, path => path);
  assert.equal(manifest.storyFont, 'rubik');
  assert.deepEqual(manifest.scenes[1].text, [words]);
  assert.equal(manifest.scenes[1].art, pages[0].image_url);
});

it('counts the actual spread filler slot against the 80-print-page maximum', () => {
  const many = Array.from({ length: 76 }, (_, idx) => ({ id: `p${idx}`, text_content: 'עמוד', image_url: 'art.png' }));
  const edition = editionDraft();
  assert.equal(editionPhysicalPageCount(edition, many), 80);
  edition.pages.p1 = { layout: 'spread' };
  assert.equal(editionPhysicalPageCount(edition, many.slice(0, 75)), 80);
  assert.equal(editionPhysicalPageCount(edition, many), 84);
  assert.ok(createDraftEditionManifest(book, many, edition, path => path).missingInputs.includes('pageLimit'));
});

it('compares authoritative art and text even when print overlays hide their changes', () => {
  const edition = example();
  const old = { ...book, printEdition: edition };
  const copy = JSON.parse(JSON.stringify(old));
  copy.printEdition.artwork = { closingArt: 'ending.png' };
  assert.equal(sameEditionSource(old, pages, copy, pages), true);
  const changed = [{ ...pages[0], image_url: 'new.png' }, pages[1]];
  assert.equal(sameEditionSource(old, pages, copy, changed), false);
  copy.printEdition.blurb = 'הועלה בלי שינוי מונה';
  assert.equal(sameEditionSource(old, pages, copy, pages), false);
});
