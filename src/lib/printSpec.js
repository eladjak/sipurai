/** Planning values only. Bleed and safe margins must be verified with the printer. */
export const PRINT_PRESETS = Object.freeze([
  Object.freeze({ id: 'square-220', widthMm: 220, heightMm: 220 }),
  Object.freeze({ id: 'square-200', widthMm: 200, heightMm: 200 }),
  Object.freeze({ id: 'portrait-165x235', widthMm: 165, heightMm: 235 }),
]);

const BLEED_MM = 3.2;
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

/** Never infer a spine from page count, including for another paper or binding. */
export function getVerifiedSpineMm(spec) {
  return isVerifiedProof(spec) ? 1.8 : null;
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
