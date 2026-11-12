// GET /api/img?p=<object path in bucket sipurai-images>
// The bucket is private; this route is the only way to read an image. Allowed when ANY of:
//   (a) the object's storage owner is the verified Clerk user,
//   (b) a row the user created (books/pages/characters.created_by) references the object
//       (covers the legacy objects that have no storage owner),
//   (c) a book with is_public = true references it (cover or page image).
// Everything else is 404, never 403: we do not reveal whether an object exists.
import { verifyClerkToken } from './_lib/verifyClerk.js';
import { defaultImageStore } from './_lib/imageStore.js';

// Only these top-level folders ever hold app images. Strict charset, no dot-segments.
const PATH_RE = /^(?:generated|uploads)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
export function validPath(p) {
  return typeof p === 'string' && p.length <= 300 && PATH_RE.test(p) && !p.split('/').some((s) => s === '.' || s === '..' || s.includes('..'));
}

function tokenFromRequest(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1];
  const cookie = req.headers?.cookie || '';
  for (const part of cookie.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name === '__session' || name.startsWith('__session_')) return part.slice(i + 1).trim();
  }
  return null;
}

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
  const token = tokenFromRequest(req);
  if (token) {
    try {
      const v = await (overrides.verify || verifyClerkToken)(token);
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
    if (userId) {
      if ((await store.objectOwner(p)) === userId) access = 'owner';
    }
    if (!access) {
      const rows = await store.referencingRows(p);
      if (userId && rows.some((r) => r.created_by === userId)) access = 'owner';
      else if (rows.some((r) => r.is_public === true)) access = 'public';
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
  res.setHeader?.('Cache-Control', access === 'owner' ? 'private, max-age=3600' : 'public, max-age=86400');
  res.setHeader?.('Content-Length', String(file.bytes.length));
  res.status(200);
  return req.method === 'HEAD' ? res.end() : res.end(file.bytes);
}
