/**
 * Parent controls over their own books: "stop sharing" and "delete book".
 *
 * Who may act: the Clerk `sub` of the verified token, and only if books.created_by equals it. The body
 * carries only the book id; it is never used to say who the user is.
 *
 * Which files are deleted (delete only): a file named by this book's cover or page images, parsed from either URL
 * form, is removed only if (a) its STORAGE owner is this user (owner_id is written by Storage from the JWT, so
 * a planted link to someone else's file does not count) and (b) no other book or page still points at it.
 * Files with no owner (pre-Clerk uploads) are left alone: we cannot prove whose they are.
 */
import { BUCKET } from './accountDeletion.js';

export const BOOK_MESSAGES = {
  unauthorized: 'נדרשת התחברות',
  badBook: 'לא נמצא הספר הזה.',
  notFound: 'לא מצאנו את הספר אצלכם. ייתכן שכבר נמחק.',
  openOrder: 'יש הזמנת הדפסה פתוחה לספר הזה, ולכן אי אפשר למחוק אותו עכשיו. אפשר למחוק אחרי שההזמנה תגיע, או בפנייה אלינו ב-support@sipurai.ai.',
  failed: 'הפעולה לא הושלמה. אפשר ללחוץ שוב. אם זה חוזר, כתבו ל-support@sipurai.ai.',
  unavailable: 'השירות לא זמין כרגע. נסו שוב בעוד רגע.',
};

// Same list as accountDeletion: these statuses mean a printed copy is still on its way.
const ORDER_OPEN = ['paid', 'submitting', 'submitted', 'in_production', 'failed_needs_attention'];
const CHUNK = 100;

/** Object path inside the bucket from either stored URL form, or null. Never throws. */
export function storagePathFromUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let path = null;
  try {
    const u = new URL(raw, 'https://app.invalid');
    if (u.pathname === '/api/img') {
      path = u.searchParams.get('p'); // URLSearchParams already decodes once
    } else {
      const m = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${BUCKET}/(.+)$`).exec(u.pathname);
      if (m) path = decodeURIComponent(m[1]);
    }
  } catch {
    return null;
  }
  if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return null;
  return path;
}

export function createSupabaseBookStore(db) {
  const must = ({ data, error, count }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return { data: data ?? [], count: count ?? 0 };
  };
  const esc = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  return {
    async findBook(bookId) {
      const { data } = must(await db.from('books').select('id,created_by,cover_image,is_public').eq('id', bookId).limit(1), 'book');
      return data[0] || null;
    },
    async openOrders(bookId, userId) {
      const r = await db.from('print_orders').select('status').eq('book_id', String(bookId)).eq('user_id', userId);
      if (r.error) {
        if (r.error.code === '42P01' || r.error.code === 'PGRST205') return 0; // printing not installed here
        throw new Error(`print_orders: ${r.error.message}`);
      }
      return (r.data || []).filter((o) => ORDER_OPEN.includes(o.status)).length;
    },
    async pageImages(bookId) {
      const { data } = must(await db.from('pages').select('image_url').eq('book_id', bookId), 'pages');
      return data.map((p) => p.image_url).filter(Boolean);
    },
    async setPrivate(bookId) {
      must(await db.from('books').update({ is_public: false }).eq('id', bookId), 'book update');
    },
    /** Removes the book's community posts and the comments on them. Returns how many posts went. */
    async removePosts(bookId) {
      const posts = must(await db.from('community').select('id').eq('book_id', bookId), 'community').data;
      const ids = posts.map((p) => p.id);
      if (ids.length) {
        must(await db.from('comments').delete().in('community_id', ids), 'comments');
        must(await db.from('community').delete().in('id', ids), 'community delete');
      }
      return ids.length;
    },
    async removeBookRows(bookId) {
      const c = await db.from('collaborations').delete().eq('book_id', bookId);
      if (c.error && !['42P01', 'PGRST205', '42703'].includes(c.error.code)) throw new Error(`collaborations: ${c.error.message}`);
      must(await db.from('pages').delete().eq('book_id', bookId), 'pages delete');
      must(await db.from('books').delete().eq('id', bookId), 'book delete');
    },
    async stillReferenced(path) {
      const base = esc(path.split('/').pop());
      const a = must(await db.from('books').select('id', { count: 'exact', head: true }).ilike('cover_image', `%${base}%`), 'ref books');
      const b = must(await db.from('pages').select('id', { count: 'exact', head: true }).ilike('image_url', `%${base}%`), 'ref pages');
      return a.count + b.count > 0;
    },
    async ownedFiles(userId) {
      const { data, error } = await db.rpc('sipurai_owned_storage_paths', { p_user: userId });
      if (error) throw new Error(`owned files: ${error.message}`);
      return new Set((data || []).map((r) => r.name).filter(Boolean));
    },
    async removeFiles(paths) {
      for (let i = 0; i < paths.length; i += CHUNK) {
        const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + CHUNK));
        if (error) throw new Error(`storage remove: ${error.message}`);
      }
    },
  };
}

const fail = (http, code, message_he) => ({ http, body: { error: { code, message_he } } });

async function ownedBook(store, userId, bookId) {
  if (!userId) return { err: fail(401, 'unauthorized', BOOK_MESSAGES.unauthorized) };
  if (typeof bookId !== 'string' && typeof bookId !== 'number') return { err: fail(400, 'bad_book', BOOK_MESSAGES.badBook) };
  const id = String(bookId).trim();
  if (!id || id.length > 80) return { err: fail(400, 'bad_book', BOOK_MESSAGES.badBook) };
  const book = await store.findBook(id);
  // Same answer for "not there" and "someone else's": do not reveal which books exist.
  if (!book || book.created_by !== userId) return { err: fail(404, 'not_found', BOOK_MESSAGES.notFound) };
  return { book };
}

export async function unshareBook({ userId, bookId, store }) {
  let stage = 'check';
  try {
    const { book, err } = await ownedBook(store, userId, bookId);
    if (err) return err;
    stage = 'private';
    await store.setPrivate(book.id); // first: from this moment the book is no longer readable by visitors
    stage = 'posts';
    const removedPosts = await store.removePosts(book.id);
    return { http: 200, body: { ok: true, removedPosts } };
  } catch (e) {
    console.error(`[books/unshare] failed at ${stage}:`, String(e?.message).slice(0, 160));
    return fail(500, `unshare_failed_${stage}`, BOOK_MESSAGES.failed);
  }
}

export async function deleteBook({ userId, bookId, store }) {
  let stage = 'check';
  try {
    const { book, err } = await ownedBook(store, userId, bookId);
    if (err) return err;
    if ((await store.openOrders(book.id, userId)) > 0) return fail(409, 'open_order', BOOK_MESSAGES.openOrder);

    stage = 'collect';
    const candidates = [...new Set([book.cover_image, ...(await store.pageImages(book.id))].map(storagePathFromUrl).filter(Boolean))];
    stage = 'public';
    await store.setPrivate(book.id); // hide first, so a failure below never leaves a half-deleted public book
    stage = 'posts';
    await store.removePosts(book.id);
    stage = 'rows';
    await store.removeBookRows(book.id);

    // The book is gone. A file problem from here on is reported, not hidden, but does not undo the deletion.
    stage = 'files';
    const owned = candidates.length ? await store.ownedFiles(userId) : new Set();
    const doomed = [];
    for (const p of candidates) if (owned.has(p) && !(await store.stillReferenced(p))) doomed.push(p);
    await store.removeFiles(doomed);
    return { http: 200, body: { ok: true, filesDeleted: doomed.length, filesKept: candidates.length - doomed.length } };
  } catch (e) {
    console.error(`[books/delete] failed at ${stage}:`, String(e?.message).slice(0, 160));
    if (stage === 'files') return { http: 200, body: { ok: true, warning: 'files_left' } };
    return fail(500, `delete_failed_${stage}`, BOOK_MESSAGES.failed);
  }
}
