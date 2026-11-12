// GET /api/img?p=<object path in bucket sipurai-images>
// The bucket is private; this route is the only way to read an image. Allowed when EITHER:
//   (a) the object's storage owner (storage.objects.owner_id, set by the server at upload) is
//       the verified Clerk user, or
//   (c) the object is referenced by a book with is_public = true (cover or a page) AND that
//       book's created_by equals the object's storage owner (so a parent cannot publish
//       someone else's file by planting its path on their own public book).
// A row that merely mentions a path is never proof of ownership (the URL is user-editable).
// Objects with no storage owner are never served. Everything else is 404, never 403.
import { verifyClerkToken } from './_lib/verifyClerk.js';
import { defaultImageStore } from './_lib/imageStore.js';

// Only these top-level folders ever hold app images. Strict charset, no dot-segments.
const PATH_RE = /^(?:generated|uploads)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
export function validPath(p) {
  return typeof p === 'string' && p.length <= 300 && PATH_RE.test(p) && !p.split('/').some((s) => s === '.' || s === '..' || s.includes('..'));
}

// Returns { token, source } where source is 'bearer' or 'cookie'.
function tokenFromRequest(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return { token: m[1], source: 'bearer' };
  const cookie = req.headers?.cookie || '';
  for (const part of cookie.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name === '__session' || name.startsWith('__session_')) return { token: part.slice(i + 1).trim(), source: 'cookie' };
  }
  return null;
}

const COOKIE_GRACE_SEC = 3600;

const notFound = (res) => {
  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(404).end();
};

export default async function handler(req, res, overrides = {}) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader?.('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const p = req.query?.p;
  if (!validPath(p)) return notFound(res);

  // Identity is optional: a stranger may still see a public book's image.
  let userId = null;
  const found = tokenFromRequest(req);
  if (found) {
    try {
      // Grace ONLY for the __session cookie (an idle tab keeps a stale cookie; an <img> cannot
      // refresh it), and only 1 hour. A Bearer token past exp is anonymous. Signature, issuer
      // and azp are always checked.
      const opts = found.source === 'cookie' ? { expiryGraceSec: COOKIE_GRACE_SEC } : { expiryGraceSec: 0 };
      const v = await (overrides.verify || verifyClerkToken)(found.token, opts);
      if (v?.ok && v.payload?.sub) userId = v.payload.sub;
    } catch { /* bad token = anonymous */ }
  }

  let store = overrides.store;
  if (!store) {
    try { store = await defaultImageStore(overrides.env || process.env); }
    catch (e) {
      console.error('[img] no database:', String(e?.message).slice(0, 120));
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(503).end();
    }
  }

  let access = null; // 'owner' | 'public' | null
  try {
    const owner = await store.objectOwner(p);
    if (owner) { // owner-less objects are never served
      if (userId && owner === userId) access = 'owner';
      else {
        const rows = await store.referencingRows(p);
        if (rows.some((r) => r.is_public === true && r.book_created_by === owner)) access = 'public';
      }
    }
  } catch (e) {
    console.error('[img] lookup failed:', String(e?.message).slice(0, 120));
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(503).end();
  }
  if (!access) return notFound(res);

  let file;
  try { file = await store.download(p); }
  catch { file = null; }
  if (!file) return notFound(res);

  res.setHeader?.('Content-Type', file.contentType);
  res.setHeader?.('X-Content-Type-Options', 'nosniff');
  res.setHeader?.('Vary', 'Cookie, Authorization');
  res.setHeader?.('Cache-Control', access === 'owner' ? 'private, max-age=3600' : 'private, max-age=600');
  res.setHeader?.('Content-Length', String(file.bytes.length));
  res.status(200);
  return req.method === 'HEAD' ? res.end() : res.end(file.bytes);
}
