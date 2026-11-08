/** Planning values only. Bleed and safe margins must be verified with the printer. */
export const PRINT_PRESETS = Object.freeze([
  Object.freeze({ id: 'square-220', widthMm: 220, heightMm: 220 }),
  Object.freeze({ id: 'square-200', widthMm: 200, heightMm: 200 }),
  Object.freeze({ id: 'portrait-165x235', widthMm: 165, heightMm: 235 }),
]);

export const BLEED_MM = 3.2;
export const MIN_PAGES = 24;
export const MAX_PAGES = 80;

/**
 * Spine thickness per sheet (two pages) for white-110gsm + soft-matte, in mm.
 * DISCREPANCY: some vendor docs say 1.65 mm for 24 pages; the vendor's own
 * preview for real order #33377 (24pp, 22x22) showed 1.8 mm = 12 sheets x 0.15.
 * We use the measured preview value (1.8). 1.65 is NOT used anywhere.
 */
export const SPINE_MM_PER_SHEET = 0.15;
export const SPINE_24PP_DOC_DISCREPANT_MM = 1.65;
const SAFE_INSET_MM = 10;
const roundMm = (n) => Math.round(n * 1000) / 1000;

/** Returns the proposed content sheet and safe rectangle, in millimetres. */
export function getPrintGeometry(presetId) {
  const preset = PRINT_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown print preset: ${presetId}`);
  return {
    content: {
      widthMm: roundMm(preset.widthMm + 2 * BLEED_MM),
      heightMm: roundMm(preset.heightMm + 2 * BLEED_MM),
    },
    safe: {
      xMm: BLEED_MM + SAFE_INSET_MM,
      yMm: BLEED_MM + SAFE_INSET_MM,
      widthMm: preset.widthMm - 2 * SAFE_INSET_MM,
      heightMm: preset.heightMm - 2 * SAFE_INSET_MM,
    },
  };
}

function isVerifiedProof(spec) {
  return spec?.presetId === 'square-220' && spec.pageCount === 24 &&
    spec.paper === 'white-110gsm' && spec.cover === 'soft-matte';
}

/** Page count must be an even integer in [24, 80]. */
export function isSupportedPageCount(n) {
  return Number.isInteger(n) && n % 2 === 0 && n >= MIN_PAGES && n <= MAX_PAGES;
}

/**
 * Print pages for a story of `storyPages` pages (the product makes 6/10/15
 * via pageCountFor): padded up to the 24-page minimum, rounded up to even.
 */
export function printPageCountFor(storyPages) {
  const n = Number(storyPages);
  if (!Number.isFinite(n) || n < 1) throw new Error('Invalid story page count');
  const even = Math.max(MIN_PAGES, Math.ceil(n / 2) * 2);
  if (!isSupportedPageCount(even)) throw new Error('Unsupported page count');
  return even;
}

/**
 * Spine for the verified paper only (white-110gsm, soft-matte).
 * Returns {mm, source, verified} or null for another paper/binding or bad page count.
 * measured-proof-24pp: exactly the vendor-previewed case (22x22, 24pp).
 * derived-linear: (pageCount/2) * 0.15 mm, not yet confirmed by a vendor preview.
 */
export function getSpine(spec) {
  if (!spec || spec.paper !== 'white-110gsm' || spec.cover !== 'soft-matte') return null;
  if (!PRINT_PRESETS.some((p) => p.id === spec.presetId)) return null;
  if (!isSupportedPageCount(spec.pageCount)) return null;
  const mm = roundMm((spec.pageCount / 2) * SPINE_MM_PER_SHEET);
  return isVerifiedProof(spec)
    ? { mm, source: 'measured-proof-24pp', verified: true }
    : { mm, source: 'derived-linear', verified: false };
}

/** Backward compatible: only the measured proof spec yields a number. */
export function getVerifiedSpineMm(spec) {
  const spine = getSpine(spec);
  return spine && spine.verified ? spine.mm : null;
}

/** Historical print cost, not a customer price or a current quote. */
export function printPrice(spec) {
  return isVerifiedProof(spec) ? { amount: 20.9, currency: 'ILS', vatIncluded: false } : null;
}

// Image providers offer discrete ratios; portrait is the closest supported ratio.
// Legacy books were generated square and must remain square on resume.
export function imageAspectForBook(book) {
  return book?.print_size === 'portrait-165x235' ? '2:3' : '1:1';
}

export function canChangePrintSize(book, pages, nextSize) {
  return imageAspectForBook(book) === imageAspectForBook({ print_size: nextSize }) ||
    (!book?.cover_image && !(pages || []).some((page) => page.image_url));
}
