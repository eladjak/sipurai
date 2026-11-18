export const TEXT_LIMITS = Object.freeze({
  creator: 75,
  blurb: 450,
  aboutAuthor: 200,
  dedication: 160,
});

export const TEXT_ZONES = ['top', 'bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
export const stripNikud = (text) => String(text || '').normalize('NFC').replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
const vowelPattern = /[\u05B0-\u05BB\u05C7]/;
export const hasHebrew = (text) => /[א-ת]/.test(text);
export const isPointed = (text) => vowelPattern.test(text);

export function editionDraft(saved = null) {
  const input = saved?.version === 1 ? saved : {};
  return {
    version: 1,
    revision: Number.isSafeInteger(input.revision) ? input.revision : 0,
    creator: input.creator || '',
    blurb: input.blurb || '',
    aboutAuthor: input.aboutAuthor || '',
    dedication: input.dedication || '',
    cover: input.cover === 'hardcover' ? 'hardcover' : 'softcover',
    paper: input.paper === 'premium' ? 'premium' : 'standard',
    pages: input.pages || {},
    artwork: input.artwork || {},
  };
}

export function initialEditionFields(value) {
  return value ? { printEdition: editionDraft(value) } : {};
}

export function printEditionUrl(id) {
  return `/PrintEdition?id=${encodeURIComponent(id)}`;
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
    text: current.text ?? source,
    approval: current.approval,
    zone: TEXT_ZONES.includes(stored?.zone) ? stored.zone : index % 2 === 0 ? 'bottom-right' : 'top-left',
    layout: stored?.layout === 'spread' ? 'spread' : 'single',
    spread: stored?.spread ?? null,
  };
}

function isExactSource(draft) {
  // The Academy’s fully pointed form of unpointed קובייה drops the mater ו.
  // Allow this one dictionary form (also with the article) only as a whole
  // word with its exact pointed spelling. Keep the stored source verbatim.
  // https://terms.hebrew-academy.org.il/munnah/24885_1/קֻבִּיָּה
  const equivalent = String(draft.text || '').normalize('NFC')
    .replace(/(?<![א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7])(הַ)?קֻּ?בִּיָּה(?![א-ת\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7])/g,
      (_, article) => `${article ? 'ה' : ''}קובייה`);
  return stripNikud(equivalent) === draft.source;
}

export function canApproveNikud(draft) {
  return isExactSource(draft) && isPointed(draft.text);
}

export function isReviewCurrent(draft) {
  if (!isExactSource(draft)) return false;
  const mode = draft.approval?.mode;
  const expected = mode === 'approved' ? draft.text : draft.source;
  if (draft.approval?.text !== expected) return false;
  return mode === 'unpointed' || (mode === 'approved' && canApproveNikud(draft));
}

export function printReviewComplete(edition, book, pages) {
  if (book.language !== 'hebrew') return true;
  return pages.every((page, index) => {
    const draft = pageDraft(edition, page, index);
    return !hasHebrew(draft.source) || isReviewCurrent(draft);
  });
}

/** The renderer accepts one physically wide art asset for each selected pair. */
export function createEditionManifest(book, pages, edition, assetPath) {
  if (book.language !== 'hebrew') throw new Error('Only Hebrew proof layout is supported');
  if (!pages.length || !printReviewComplete(edition, book, pages)) throw new Error('Text review is incomplete');
  if (book.print_size && book.print_size !== 'square-220') throw new Error('Only 22 × 22 cm proof layout is supported');
  const scenes = [];
  let hasApprovedNikud = false;
  for (let index = 0; index < pages.length;) {
    const draft = pageDraft(edition, pages[index], index);
    const isSpread = draft.layout === 'spread';
    if (isSpread && (!pages[index + 1] || edition.pages[pages[index + 1].id]?.layout === 'spread')) {
      throw new Error('Overlapping print spreads');
    }
    const text = [];
    const zones = [];
    const pointing = [];
    for (let offset = 0; offset < (isSpread ? 2 : 1); offset += 1) {
      const current = pageDraft(edition, pages[index + offset], index + offset);
      const mode = current.approval?.mode === 'approved' ? 'approved' : 'unpointed';
      zones.push(current.zone);
      pointing.push(mode);
      text.push(mode === 'approved' ? current.text : current.source);
      hasApprovedNikud ||= mode === 'approved';
    }
    scenes.push({
      layout: isSpread ? 'spread' : 'single',
      art: assetPath(isSpread ? draft.spread : pages[index].image_url),
      text,
      zones,
      pointing,
    });
    index += isSpread ? 2 : 1;
  }

  const optionalArt = Object.fromEntries(
    Object.entries(edition.artwork)
      .filter(([key, src]) => src && ['characterSheet', 'closingArt', 'dedicationArt', 'endpaperArt'].includes(key))
      .map(([key, src]) => [key, assetPath(src)]),
  );
  return {
    version: 1,
    title: book.title,
    creator: edition.creator.trim(),
    blurb: edition.blurb.trim(),
    aboutAuthor: edition.aboutAuthor.trim(),
    dedication: edition.dedication.trim(),
    coverArt: assetPath(book.cover_image),
    closingArt: assetPath(edition.artwork.closingArt),
    characterSheet: assetPath(edition.artwork.characterSheet || book.cover_image),
    scenes,
    ...optionalArt,
    qrUrl: `https://www.sipurai.ai/b/print/${encodeURIComponent(book.id)}`,
    nikudStatus: hasApprovedNikud ? 'approved' : 'unpointed',
    widthMm: 220,
    heightMm: 220,
    binding: 'soft-matte',
    paper: 'white-110gsm',
    bleedMm: 3.2,
    signatureMultiple: 4,
    minPages: 24,
    gutterMm: 5,
  };
}
