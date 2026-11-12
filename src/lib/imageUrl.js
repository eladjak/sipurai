/**
 * Images live in the PRIVATE bucket `sipurai-images` and are read through GET /api/img.
 * imageProxyUrl(path)  -> '/api/img?p=generated%2Ffile.png' (same-origin relative URL)
 * toAppImageUrl(url)   -> maps an old public bucket URL to the proxy form. Idempotent;
 *                         anything that is not a bucket URL is returned unchanged.
 */
const MARK = '/storage/v1/object/public/sipurai-images/';

export function imageProxyUrl(path) {
  return `/api/img?p=${encodeURIComponent(path)}`;
}

export function toAppImageUrl(url) {
  if (typeof url !== 'string') return url;
  const i = url.indexOf(MARK);
  if (i < 0) return url;
  let path = url.slice(i + MARK.length).split(/[?#]/)[0];
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  return path ? imageProxyUrl(path) : url;
}
