/**
 * Data access for GET /api/img (service role). Kept apart from the route so tests can swap it.
 *
 * Matching rows to an object compares the exact object PATH, never a loose substring. A LIKE
 * query only narrows candidates (and `_` is a wildcard in LIKE), then pathFromStoredUrl()
 * decides. Both stored URL forms count: the old public URL and the new proxy URL.
 */
import { serviceClient } from './consent.js';

export const BUCKET = 'sipurai-images';
const PUBLIC_MARK = `/${BUCKET}/`;

/** Extracts the bucket path from either stored form. Returns null for anything else. */
export function pathFromStoredUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  try {
    const u = new URL(url, 'https://app.invalid');
    if (u.pathname === '/api/img') return u.searchParams.get('p');
    const i = u.pathname.indexOf('/storage/v1/object/public' + PUBLIC_MARK);
    if (i >= 0) return decodeURIComponent(u.pathname.slice(i + '/storage/v1/object/public'.length + PUBLIC_MARK.length));
  } catch { /* not a URL */ }
  return null;
}

const COLS = {
  books: ['cover_image'],
  pages: ['image_url'],
  characters: ['primary_image_url'],
};

export function createSupabaseImageStore(db) {
  return {
    /** storage.objects.owner_id, or null (no such object / no owner). Needs sipurai_object_owner(). */
    async objectOwner(path) {
      const { data, error } = await db.rpc('sipurai_object_owner', { p_name: path });
      if (error) throw new Error(`owner lookup: ${error.message}`);
      return data || null;
    },
    /**
     * Rows that reference this exact object: [{ table, created_by, is_public }].
     * is_public is the BOOK's flag (for a page, looked up through book_id).
     */
    async referencingRows(path) {
      const out = [];
      const patterns = [`%${PUBLIC_MARK}${path}`, `%p=${encodeURIComponent(path)}`];
      for (const [table, cols] of Object.entries(COLS)) {
        for (const col of cols) {
          for (const pat of patterns) {
            const sel = table === 'books' ? `created_by,is_public,${col}`
              : table === 'pages' ? `created_by,book_id,${col}` : `created_by,${col}`;
            const { data, error } = await db.from(table).select(sel).like(col, pat).limit(50);
            if (error) throw new Error(`${table} lookup: ${error.message}`);
            for (const r of data || []) {
              if (pathFromStoredUrl(r[col]) !== path) continue;
              out.push({ table, created_by: r.created_by || null, book_id: r.book_id, is_public: table === 'books' ? r.is_public === true : false });
            }
          }
        }
      }
      const bookIds = [...new Set(out.filter((r) => r.table === 'pages' && r.book_id).map((r) => r.book_id))];
      if (bookIds.length) {
        const { data, error } = await db.from('books').select('id,is_public').in('id', bookIds);
        if (error) throw new Error(`books lookup: ${error.message}`);
        const pub = new Set((data || []).filter((b) => b.is_public === true).map((b) => b.id));
        for (const r of out) if (r.table === 'pages') r.is_public = pub.has(r.book_id);
      }
      return out;
    },
    /** { bytes: Buffer, contentType } or null when the object does not exist. */
    async download(path) {
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
    },
  };
}

export async function defaultImageStore(env = process.env) {
  return createSupabaseImageStore(await serviceClient(env));
}
