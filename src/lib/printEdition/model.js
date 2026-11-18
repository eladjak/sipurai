import { MAX_PAGES, MIN_PAGES, PRINT_PRESETS, PRINT_SIGNATURE_PAGES } from '../printSpec.js';

export const TEXT_LIMITS = Object.freeze({
  printTitle: 130,
  copyright: 240,
  creator: 75,
  blurb: 450,
  aboutAuthor: 200,
  dedication: 160,
});

export const STORY_TEXT_LIMIT = 4000;
export const EDIT_INSTRUCTION_LIMIT = 300;
export const STORY_FONTS = ['david-libre', 'rubik'];
export const TEXT_ZONES = ['top', 'bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
const unsupportedBidi = /[\u202A-\u202E\u2066-\u2069]/;
export const stripNikud = (text) => String(text || '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
const nikudPattern = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/;
const vowelPattern = /[\u05B0-\u05BB\u05C7]/;
export const hasHebrew = (text) => /[א-ת]/.test(text);
export const isPointed = (text) => vowelPattern.test(text);

export function editionDraft(saved = null) {
  const input = saved?.version === 1 ? saved : {};
  return {
    version: 1,
    ...(input.defaultPanel === 'integrated' ? { defaultPanel: 'integrated' } : {}),
    revision: Number.isSafeInteger(input.revision) ? input.revision : 0,
    printTitle: input.printTitle || '',
    copyright: input.copyright || '',
    creator: input.creator || '',
    blurb: input.blurb || '',
    aboutAuthor: input.aboutAuthor || '',
    dedication: input.dedication || '',
    matterApproval: input.matterApproval || null,
    cover: input.cover === 'hardcover' ? 'hardcover' : 'softcover',
    paper: ['standard', 'premium', 'chrome-matte-130', 'chrome-matte-170'].includes(input.paper) ? input.paper : 'standard',
    storyFont: STORY_FONTS.includes(input.storyFont) ? input.storyFont : STORY_FONTS[0],
    extraPages: Array.isArray(input.extraPages) ? [...new Set(input.extraPages.filter(id => /^extra-[a-f0-9-]{36}$/.test(id)))].slice(0, MAX_PAGES - 4) : [],
    pages: input.pages || {},
    artwork: input.artwork || {},
  };
}

export function initialEditionFields(value) {
  if (!value) return {};
  return { printEdition: { ...editionDraft(value), defaultPanel: 'integrated' } };
}

export function printEditionUrl(id) {
  return `/PrintEdition?id=${encodeURIComponent(id)}`;
}

export function editionStoryPages(edition, pages) {
  const extra = edition.extraPages || [];
  return extra.length ? [
    ...pages,
    ...extra.map((id, index) => ({ id, page_number: pages.length + index + 1, text_content: '', image_url: null, extra: true })),
  ] : pages;
}

/** Count the native signature slots, including the blank between an unmatched left page and a spread. */
export function editionPhysicalPageCount(edition, pages) {
  let occupied = 3; // Title, dedication/endpaper, and copyright.
  for (let index = 0; index < pages.length; index += 1) {
    const first = pages[index];
    const next = pages[index + 1];
    const spread = edition.pages[first.id]?.layout === 'spread' && next
      && edition.pages[next.id]?.layout !== 'spread';
    if (spread) {
      if (occupied % 2 === 0) occupied += 1;
      occupied += 2;
      index += 1;
    } else {
      occupied += 1;
    }
  }
  const withClosing = Math.max(occupied + 1, MIN_PAGES);
  return Math.ceil(withClosing / PRINT_SIGNATURE_PAGES) * PRINT_SIGNATURE_PAGES;
}

export function sourceText(page) {
  return stripNikud(page.text_content).trim();
}

export function pageDraft(edition, page, index) {
  const source = sourceText(page);
  const stored = edition.pages[page.id];
  const current = stored?.source === source ? stored : {};
  return {
    source,
    sourceParagraphs: current.sourceParagraphs,
    ...(typeof current.rewrite === 'string' ? { rewrite: current.rewrite } : {}),
    text: current.text ?? source,
    approval: current.approval,
    zone: TEXT_ZONES.includes(stored?.zone) ? stored.zone : index % 2 === 0 ? 'bottom-right' : 'top-left',
    layout: stored?.layout === 'spread' ? 'spread' : 'single',
    spread: stored?.spread ?? null,
    printArt: stored?.printArt ?? null,
    printSettings: stored?.printSettings ?? null,
  };
}

export const reviewSource = draft => draft.rewrite ?? draft.source;

function isExactSource(draft) {
  // The Academy’s fully pointed form of unpointed קובייה drops the mater ו.
  // Allow this one dictionary form (also with the article) only as a whole
  // word with its exact pointed spelling. Keep the stored source verbatim.
  // https://terms.hebrew-academy.org.il/munnah/24885_1/קֻבִּיָּה
  const equivalent = String(draft.text || '').normalize('NFC')
    .replace(/(?<![א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7])(הַ)?קֻּ?בִּיָּה(?![א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7])/g,
      (_, article) => `${article ? 'ה' : ''}קובייה`);
  return stripNikud(equivalent) === reviewSource(draft) || stripNikud(draft.text) === reviewSource(draft);
}

export function editPageText(draft, text) {
  const rewrite = isExactSource({ ...draft, text }) ? draft.rewrite : stripNikud(text);
  return { text, rewrite: rewrite === draft.source ? undefined : rewrite, approval: null };
}

export function canApproveNikud(draft) {
  return isSafeStoryText(draft.text) && isExactSource(draft) && isPointed(draft.text);
}

export function isReviewCurrent(draft) {
  if (!isSafeStoryText(draft.text) || !isExactSource(draft)) return false;
  const mode = draft.approval?.mode;
  const expected = mode === 'approved' ? draft.text : reviewSource(draft);
  if (draft.approval?.text !== expected) return false;
  return mode === 'unpointed' ? draft.text === reviewSource(draft) : mode === 'approved' && canApproveNikud(draft);
}

const printTitle = (edition, book) => edition.printTitle.trim() || book.title;
const matterText = (edition, book) => [printTitle(edition, book), edition.copyright, edition.creator,
  edition.blurb, edition.aboutAuthor, edition.dedication];

export function editionHasUnsafeText(edition, book, pages) {
  return matterText(edition, book).some(text => unsupportedBidi.test(text)) ||
    pages.some((page, index) => unsupportedBidi.test(pageDraft(edition, page, index).text));
}

export function isSafeStoryText(value) {
  return typeof value === 'string' && value.length <= STORY_TEXT_LIMIT && Boolean(value.trim()) && !unsupportedBidi.test(value);
}

export function needsPageReview(draft, language) {
  return language === 'hebrew' && (hasHebrew(draft.source) || hasHebrew(draft.text));
}

export function matterReview(edition, book) {
  const text = matterText(edition, book);
  const needsReview = text.some(value => nikudPattern.test(value));
  const snapshot = JSON.stringify(text);
  return { approved: edition.matterApproval === snapshot, needsReview, snapshot };
}

export function printReviewComplete(edition, book, pages) {
  if (book.language !== 'hebrew') return true;
  const matter = matterReview(edition, book);
  if (matter.needsReview && !matter.approved) return false;
  return pages.every((page, index) => {
    const draft = pageDraft(edition, page, index);
    return isSafeStoryText(draft.text) && (!needsPageReview(draft, book.language) || isReviewCurrent(draft));
  });
}

/** The renderer accepts one physically wide art asset for each selected pair. */
export function createEditionManifest(book, pages, edition, assetPath) {
  if (book.language !== 'hebrew') throw new Error('Only Hebrew proof layout is supported');
  if (editionHasUnsafeText(edition, book, pages)) throw new Error('Unsupported bidi controls');
  if (!pages.length || !printReviewComplete(edition, book, pages)) throw new Error('Text review is incomplete');
  if (book.print_size && !PRINT_PRESETS.some(item => item.id === book.print_size)) throw new Error('Unsupported print size');
  if (editionPhysicalPageCount(edition, pages) > MAX_PAGES) throw new Error('Edition exceeds the maximum print page count');
  return buildManifest(book, pages, edition, assetPath);
}

/** The exact print layout, with the on-screen text and missing inputs reported to the owner. */
export function createDraftEditionManifest(book, pages, edition, assetPath) {
  const missingInputs = [];
  if (!pages.length) missingInputs.push('scenes');
  if (editionPhysicalPageCount(edition, pages) > MAX_PAGES) missingInputs.push('pageLimit');
  if (book.language !== 'hebrew') missingInputs.push('language');
  if (book.print_size && !PRINT_PRESETS.some(item => item.id === book.print_size)) missingInputs.push('printSize');
  if (editionHasUnsafeText(edition, book, pages)) missingInputs.push('unsafeText');
  if (!printTitle(edition, book)?.trim()) missingInputs.push('title');
  if (!edition.creator.trim()) missingInputs.push('creator');
  if (!edition.blurb.trim()) missingInputs.push('blurb');
  const manifest = buildManifest(book, pages, edition, assetPath, missingInputs);
  return { ...manifest, missingInputs };
}

function buildManifest(book, pages, edition, assetPath, missingInputs) {
  if (!['standard', 'chrome-matte-130', 'chrome-matte-170'].includes(edition.paper)) throw new Error('Paper choice required');
  const draftProof = Boolean(missingInputs);
  const mapArt = (src, name) => {
    if (!src && draftProof) {
      missingInputs.push(name);
      return null;
    }
    return assetPath(src);
  };
  const scenes = [];
  const matter = matterReview(edition, book);
  let hasApprovedNikud = matter.needsReview;
  const pending = draftProof && !printReviewComplete(edition, book, pages);
  const preset = PRINT_PRESETS.find(item => item.id === book.print_size) || PRINT_PRESETS[0];
  for (let index = 0; index < pages.length;) {
    const draft = pageDraft(edition, pages[index], index);
    const overlaps = draft.layout === 'spread' && (!pages[index + 1] || edition.pages[pages[index + 1].id]?.layout === 'spread');
    if (overlaps) {
      if (!draftProof) throw new Error('Overlapping print spreads');
      missingInputs.push(`scene:${index}:layout`);
    }
    const isSpread = draft.layout === 'spread' && !overlaps;
    const text = [];
    const zones = [];
    const pointing = [];
    for (let offset = 0; offset < (isSpread ? 2 : 1); offset += 1) {
      const current = pageDraft(edition, pages[index + offset], index + offset);
      const reviewed = isReviewCurrent(current);
      const mode = reviewed && current.approval.mode === 'approved' ? 'approved'
        : pending && nikudPattern.test(current.text) ? 'pending' : 'unpointed';
      if (draftProof && !isSafeStoryText(current.text)) missingInputs.push(`scene:${index + offset}:text`);
      zones.push(current.zone);
      pointing.push(mode);
      text.push(draftProof || mode === 'approved' ? current.text : reviewSource(current));
      hasApprovedNikud ||= mode === 'approved';
    }
    const settings = draft.printSettings || {};
    const widthCount = isSpread ? 2 : 1;
    const panelWidths = Array.isArray(settings.panelWidthsMm) && settings.panelWidthsMm.length === widthCount
      ? settings.panelWidthsMm : null;
    scenes.push({
      layout: isSpread ? 'spread' : 'single',
      art: mapArt(isSpread ? draft.spread : draft.printArt || pages[index].image_url, `scene:${index}:${isSpread ? 'spreadArt' : 'art'}`),
      text,
      zones,
      pointing,
      ...(settings.anchor ? { anchor: settings.anchor } : {}),
      ...((settings.panel || edition.defaultPanel) ? { panel: settings.panel || edition.defaultPanel } : {}),
      ...(panelWidths ? { panelWidthsMm: panelWidths } : {}),
    });
    index += isSpread ? 2 : 1;
  }

  const optionalArt = Object.fromEntries(
    ['dedicationArt', 'endpaperArt'].filter(key => edition.artwork[key]).map(key => [key, assetPath(edition.artwork[key])]),
  );
  return {
    version: 1,
    title: printTitle(edition, book),
    copyright: edition.copyright.trim(),
    creator: edition.creator.trim(),
    blurb: edition.blurb.trim(),
    aboutAuthor: edition.aboutAuthor.trim(),
    dedication: edition.dedication.trim(),
    coverArt: mapArt(edition.artwork.coverArt || book.cover_image, 'coverArt'),
    closingArt: mapArt(edition.artwork.closingArt, 'closingArt'),
    characterSheet: draftProof && !(edition.artwork.characterSheet || book.cover_image)
      ? null : assetPath(edition.artwork.characterSheet || book.cover_image),
    scenes,
    ...optionalArt,
    qrUrl: `https://www.sipurai.ai/b/print/${encodeURIComponent(book.id)}`,
    nikudStatus: pending ? 'pending' : hasApprovedNikud ? 'approved' : 'unpointed',
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    binding: 'soft-matte',
    paper: edition.paper === 'standard' ? 'white-110gsm' : edition.paper,
    requestedFinishing: { cover: edition.cover, paper: edition.paper },
    ...(edition.storyFont === 'rubik' ? { storyFont: edition.storyFont } : {}),
    bleedMm: 3.2,
    signatureMultiple: 4,
    minPages: 24,
    gutterMm: 5,
  };
}


function sameSourceValue(first, second) {
  if (Object.is(first, second)) return true;
  if (!first || !second || typeof first !== 'object' || typeof second !== 'object'
      || Array.isArray(first) !== Array.isArray(second)) return false;
  const keys = Object.keys(first).filter(key => first[key] !== undefined);
  if (keys.length !== Object.keys(second).filter(key => second[key] !== undefined).length) return false;
  return keys.every(key => Object.hasOwn(second, key) && sameSourceValue(first[key], second[key]));
}

/** Confirm the saved edition and every underlying story input still match what the editor opened. */
export function sameEditionSource(oldBook, oldRows, newBook, newRows) {
  const sameBook = ['id', 'title', 'language', 'print_size', 'cover_image', 'total_pages']
    .every(key => oldBook[key] === newBook[key]);
  if (!sameBook || !sameSourceValue(editionDraft(oldBook.printEdition), editionDraft(newBook.printEdition))) return false;
  const sameStory = ['id', 'page_number', 'text_content', 'image_url'];
  return oldRows.length === newRows.length && oldRows.every((row, index) => sameStory.every(key => row[key] === newRows[index][key]));
}
