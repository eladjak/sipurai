/**
 * Hebrew / RTL text helpers for PDF export (and any canvas-like renderer
 * that draws glyphs in visual order).
 *
 * jsPDF draws characters in the order given (visual order, left-to-right).
 * Hebrew strings are stored in LOGICAL order, so they must be reordered
 * per-line via the Unicode Bidirectional Algorithm (UAX#9) before drawing.
 * We use bidi-js (proper UAX#9 implementation, zero deps) — hand-rolled
 * reversal breaks on mixed content (numbers, Latin words, brackets).
 *
 * Pure module: no DOM, importable from Node test scripts.
 */

const HEBREW_RE = /[֐-׿]/;

/** True if the string contains at least one Hebrew-block character. */
export function containsHebrew(text) {
  return HEBREW_RE.test(text || '');
}

/**
 * UAX#9 P2/P3 first-strong heuristic: does the paragraph's base direction
 * resolve to RTL? Used to pick block alignment (right vs left).
 * Scans for the first strong-directional character.
 */
export function firstStrongIsRTL(text) {
  if (!text) return false;
  // Hebrew block = strong RTL; basic Latin letters = strong LTR
  const m = /[֐-׿]|[A-Za-z]/.exec(text);
  return !!m && HEBREW_RE.test(m[0]);
}

/**
 * Lazily create a single bidi-js instance (it compiles its tables once).
 * bidi-js exports a factory function as default.
 */
let _bidi = null;
async function getBidi() {
  if (!_bidi) {
    const mod = await import('bidi-js');
    const factory = mod.default || mod;
    _bidi = factory();
  }
  return _bidi;
}

/**
 * Reorder ONE line of logical text into visual order for RTL rendering,
 * applying bracket mirroring. Each wrapped line must be reordered
 * separately (standard practice for line-based PDF writers).
 *
 * @param {string} line - logical-order text (one visual line)
 * @returns {Promise<string>} visual-order text ready for LTR glyph drawing
 */
export async function toVisualRTL(line) {
  if (!line || !containsHebrew(line)) return line;
  const bidi = await getBidi();
  // 'auto' base direction (UAX#9 first-strong): Hebrew-first lines render
  // RTL, English-first lines with embedded Hebrew stay LTR — only the
  // Hebrew runs are reversed. getReorderedString also mirrors brackets
  // (verified: "(שלום)" → "(םולש)", "שלום (חבר) טוב" → "בוט (רבח) םולש").
  const embedding = bidi.getEmbeddingLevels(line, 'auto');
  return bidi.getReorderedString(line, embedding);
}

/**
 * Reorder an array of wrapped lines (as returned by jsPDF splitTextToSize)
 * into visual order.
 */
export async function linesToVisualRTL(lines) {
  const arr = Array.isArray(lines) ? lines : [lines];
  return Promise.all(arr.map((l) => toVisualRTL(l)));
}

/** Convert an ArrayBuffer (TTF bytes) to base64 without call-stack overflow. */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  // btoa exists in browsers; Buffer path covers Node (test scripts)
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}
