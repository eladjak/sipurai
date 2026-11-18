export function proofLeaves(proof) {
  const { pages, coverUrl, insideUrl, trimWidthMm: width, trimHeightMm: height, bleedMm: bleed, spineMm: spine } = proof || {};
  if (!Array.isArray(pages) || pages.length < 2 || pages.length % 2 !== 0 || !pages.every(page => page?.url)
    || !coverUrl || ![width, height, bleed, spine].every(Number.isFinite)
    || width <= 0 || height <= 0 || bleed < 0 || spine < 0) return null;

  const pageMedia = { width: width + 2 * bleed, height: height + 2 * bleed };
  const wrapMedia = { width: 2 * width + spine + 2 * bleed, height: pageMedia.height };
  const crop = (x, y, w, h) => ({ x, y, width: w, height: h });
  const front = {
    url: coverUrl, kind: 'front', field: 'printTitle', media: wrapMedia,
    trim: crop(bleed, bleed, width, height), full: crop(0, 0, width + bleed, wrapMedia.height),
  };
  const back = {
    url: coverUrl, kind: 'back', field: 'blurb', media: wrapMedia,
    trim: crop(bleed + width + spine, bleed, width, height), full: crop(bleed + width + spine, 0, width + bleed, wrapMedia.height),
  };
  const binding = {
    url: coverUrl, kind: 'spine', media: wrapMedia,
    trim: crop(bleed + width, bleed, spine, height), full: crop(bleed + width, 0, spine, wrapMedia.height),
  };
  const cover = { kind: 'cover', leaves: [front, ...(spine > 0 ? [binding] : []), back] };

  const inside = (kind, x) => ({
    url: insideUrl, kind, field: kind === 'insideBack' ? 'closingArt' : 'endpaperArt', media: wrapMedia,
    trim: crop(x + bleed, bleed, width, height), full: crop(x, 0, pageMedia.width, pageMedia.height),
  });
  const leaves = pages.map((page, index) => ({
    ...page,
    number: index + 1,
    media: pageMedia,
    trim: crop(bleed, bleed, width, height),
    full: crop(0, 0, pageMedia.width, pageMedia.height),
  }));
  const spreads = [{ kind: 'opening', leaves: [inside('insideFront', width + spine), leaves[0]] }];
  for (let index = 1; index < leaves.length - 1; index += 2) {
    spreads.push({ kind: 'pages', leaves: leaves.slice(index, index + 2) });
  }
  spreads.push({ kind: 'closing', leaves: [leaves.at(-1), inside('insideBack', 0)] });
  return [cover, ...spreads];
}

export function proofEditTarget(leaf) {
  switch (leaf.kind) {
    case 'front':
    case 'back':
      return { kind: 'cover', field: leaf.field };
    case 'insideBack':
      return { kind: 'closing', field: 'closingArt' };
    case 'insideFront':
    case 'endpaper':
      return { kind: 'endpaper', field: 'endpaperArt' };
    case 'story':
      return Number.isInteger(leaf.storyIndex) && leaf.storyIndex >= 0
        ? { kind: 'story', storyIndex: leaf.storyIndex, field: 'text' }
        : null;
    case 'title':
      return { kind: 'title', field: 'printTitle' };
    case 'dedication':
      return { kind: 'dedication', field: 'dedication' };
    case 'copyright':
      return { kind: 'copyright', field: 'copyright' };
    case 'closing':
      return { kind: 'closing', field: 'closingArt' };
    default:
      return null;
  }
}
