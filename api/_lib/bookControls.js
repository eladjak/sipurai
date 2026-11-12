/**
 * Parent controls over their own books: "stop sharing" and "delete book".
 *
 * Who may act: the Clerk `sub` of the verified token, and only if books.created_by equals it. The body
 * carries only the book id; it is never used to say who the user is.
 *
 * Delete: the whole database part (ownership re-check under a row lock, open print order check, deleting
 * comments / posts / collaborations / pages / the book) is ONE SQL function, public.sipurai_delete_book
 * (scripts/migrations/2026-11-12-book-delete.sql), so it either happens completely or not at all. The function
 * returns the file paths that may be removed: owned by this user in Storage (owner_id is written by Storage from
 * the JWT, so a planted link to someone else's file never counts) and no longer used by any cover, page,
 * character or avatar. This module then removes those files. If that fails the book is already gone: we answer 200
 * with warning 'files_left' and log the paths so they can be cleaned up.
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

export class DeleteRefused extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

export function createSupabaseBookStore(db) {
  const must = ({ data, error, count }, what) => {
    if (error) throw new Error(`${what}: ${error.message}`);
    return { data: data ?? [], count: count ?? 0 };
  };
  return {
    async findBook(bookId) {
      const { data } = must(await db.from('books').select('id,created_by,cover_image,is_public').eq('id', bookId).limit(1), 'book');
      return data[0] || null;
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
    /**
     * One transaction in the database. Returns the object paths that may now be removed from storage.
     * Throws DeleteRefused('not_found' | 'open_order') when the function refuses, Error for anything else.
     */
    async deleteBookAtomic(bookId, userId) {
      const { data, error } = await db.rpc('sipurai_delete_book', { p_book: bookId, p_user: userId });
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('sipurai_open_order')) throw new DeleteRefused('open_order');
        if (msg.includes('sipurai_not_found')) throw new DeleteRefused('not_found');
        throw new Error(`delete rpc: ${msg}`);
      }
      return (Array.isArray(data) ? data : []).map((r) => (typeof r === 'string' ? r : r?.sipurai_delete_book)).filter(Boolean);
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
  let doomed = [];
  try {
    const { book, err } = await ownedBook(store, userId, bookId);
    if (err) return err;
    stage = 'database';
    doomed = await store.deleteBookAtomic(book.id, userId); // all rows, one transaction; refuses on open order
  } catch (e) {
    if (e instanceof DeleteRefused) {
      return e.reason === 'open_order' ? fail(409, 'open_order', BOOK_MESSAGES.openOrder) : fail(404, 'not_found', BOOK_MESSAGES.notFound);
    }
    console.error(`[books/delete] failed at ${stage}:`, String(e?.message).slice(0, 160));
    return fail(500, `delete_failed_${stage}`, BOOK_MESSAGES.failed);
  }

  // The book is gone. A file problem from here on is reported, not hidden, but does not undo the deletion.
  try {
    await store.removeFiles(doomed);
    return { http: 200, body: { ok: true, filesDeleted: doomed.length } };
  } catch (e) {
    console.error('[books/delete] files left in storage, remove by hand:', JSON.stringify(doomed), String(e?.message).slice(0, 160));
    return { http: 200, body: { ok: true, warning: 'files_left', filesLeft: doomed.length } };
  }
}
