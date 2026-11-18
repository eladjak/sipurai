// Only the trusted server-side print asset provider may supply this record.
// The production store currently has no such provider; callers fail closed.
export function stockFileBinding(files, spec) {
  const p = files?.proof;
  const gs = value => typeof value === "string" && /^gs:\/\/[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9._/-]+\.pdf$/i.test(value) && !value.includes("..");
  const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (files?.vendorIssued !== true || !gs(files.contentUrl) || !gs(files.coverUrl) ||
      p?.version !== 1 || p.paper !== spec.paper || p.presetId !== spec.presetId ||
      p.pageCount !== spec.pageCount || p.cover !== spec.cover ||
      !hash(p.contentSha256) || !hash(p.coverSha256) ||
      p.contentUri !== files.contentUrl || p.coverUri !== files.coverUrl ||
      typeof p.contentGeneration !== 'string' || typeof p.coverGeneration !== 'string' ||
      !/^[1-9][0-9]*$/.test(p.contentGeneration) || !/^[1-9][0-9]*$/.test(p.coverGeneration)) return null;
  return { version: 1, paper: p.paper, presetId: p.presetId, pageCount: p.pageCount,
    cover: p.cover, contentSha256: p.contentSha256, coverSha256: p.coverSha256,
    contentUri: p.contentUri, coverUri: p.coverUri, contentGeneration: p.contentGeneration, coverGeneration: p.coverGeneration };
}

export function sameStockBinding(a, b) {
  return Boolean(a && b && ['version', 'paper', 'presetId', 'pageCount', 'cover', 'contentSha256', 'coverSha256', 'contentUri', 'coverUri', 'contentGeneration', 'coverGeneration'].every(key => a[key] === b[key]));
}
