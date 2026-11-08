import { jsPDF } from 'jspdf';
import { PRINT_PRESETS, BLEED_MM, getPrintGeometry, getSpine, isSupportedPageCount } from '../lib/printSpec.js';

// Internal prepress API. Artwork is placed wholly inside the safe rectangle;
// the surrounding trim and bleed are white. It does not create book layouts.
function proofPreset(spec) {
  const preset = PRINT_PRESETS.find(item => item.id === spec?.presetId);
  if (!preset || !isSupportedPageCount(spec.pageCount) || spec.paper !== 'white-110gsm' || spec.cover !== 'soft-matte') {
    throw new Error('Unsupported print specification');
  }
  return preset;
}
function newPdf(width, height) {
  return new jsPDF({ unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait', compress: true });
}
function prepare(doc, bytes, box, cache = new WeakMap()) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Artwork must be original PNG or JPEG bytes');
  let props;
  try { props = cache.get(bytes) || doc.getImageProperties(bytes); cache.set(bytes, props); } catch { throw new Error('Invalid PNG or JPEG artwork'); }
  if (!['PNG', 'JPEG'].includes(props.fileType) || !props.width || !props.height) throw new Error('Invalid PNG or JPEG artwork');
  const scale = Math.min(box.widthMm / props.width, box.heightMm / props.height);
  const width = props.width * scale, height = props.height * scale;
  if (props.width / (width / 25.4) < 300 || props.height / (height / 25.4) < 300) {
    throw new Error('Artwork is below 300 dpi at print size');
  }
  return { bytes, format: props.fileType, x: box.xMm + (box.widthMm - width) / 2, y: box.yMm + (box.heightMm - height) / 2, width, height };
}
function draw(doc, image, alias) {
  doc.addImage(image.bytes, image.format, image.x, image.y, image.width, image.height, alias);
}

/** Exactly spec.pageCount (even, 24..80) finished page artworks; returns a jsPDF document. */
export function createInteriorPdf(spec, pages) {
  proofPreset(spec);
  if (!Array.isArray(pages) || pages.length !== spec.pageCount) throw new Error(`Exactly ${spec.pageCount} page artworks are required`);
  const { content, safe } = getPrintGeometry(spec.presetId);
  const doc = newPdf(content.widthMm, content.heightMm);
  // Preflight everything before creating output; no skipped or substituted pages.
  const cache = new WeakMap();
  const images = pages.map(page => prepare(doc, page, safe, cache));
  const aliases = new WeakMap();
  images.forEach((image, i) => { if (i) doc.addPage([content.widthMm, content.heightMm], content.widthMm > content.heightMm ? 'landscape' : 'portrait'); let alias = aliases.get(image.bytes); if (!alias) { alias = `page-${i}`; aliases.set(image.bytes, alias); } draw(doc, image, alias); });
  return doc;
}

/**
 * RTL spread (flat, as printed): BACK on the left, FRONT on the right, because
 * a right-to-left book opens from the right. Empty white spine, no spine text.
 * Size: 2*trimWidth + spine + 2*bleed by trimHeight + 2*bleed.
 */
export function createCoverPdf(spec, { front, back } = {}) {
  const preset = proofPreset(spec);
  const spine = getSpine(spec);
  if (!spine) throw new Error('Unsupported spine specification');
  const { content, safe } = getPrintGeometry(spec.presetId);
  const doc = newPdf(2 * preset.widthMm + spine.mm + 2 * BLEED_MM, content.heightMm);
  const backImage = prepare(doc, back, safe);
  const frontImage = prepare(doc, front, { ...safe, xMm: safe.xMm + preset.widthMm + spine.mm });
  draw(doc, backImage, 'back');
  draw(doc, frontImage, 'front');
  return doc;
}

/** One entry point: interior + cover PDFs and the sizes they were built to. */
export function buildPrintPackage(spec, { pages, front, back } = {}) {
  const interior = createInteriorPdf(spec, pages);
  const cover = createCoverPdf(spec, { front, back });
  const spine = getSpine(spec);
  const { content } = getPrintGeometry(spec.presetId);
  const preset = PRINT_PRESETS.find(item => item.id === spec.presetId);
  return {
    interior,
    cover,
    meta: {
      interiorPageSizeMm: { widthMm: content.widthMm, heightMm: content.heightMm },
      coverSizeMm: { widthMm: Math.round((2 * preset.widthMm + spine.mm + 2 * BLEED_MM) * 1000) / 1000, heightMm: content.heightMm },
      spineMm: spine.mm,
      pageCount: spec.pageCount,
    },
  };
}
