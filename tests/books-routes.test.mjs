import test from 'node:test';
import assert from 'node:assert/strict';
import unshareHandler from '../api/books/unshare.js';
import deleteHandler from '../api/books/delete.js';
import { deleteBook, unshareBook, storagePathFromUrl } from '../api/_lib/bookControls.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const asUser = (sub) => async () => ({ ok: true, payload: { sub } });
const noUser = async () => ({ ok: false, reason: 'no bearer token' });
const PUB = (p) => `https://x.supabase.co/storage/v1/object/public/sipurai-images/${p}`;
const PROXY = (p) => `/api/img?p=${encodeURIComponent(p)}`;

/** In-memory world with the same interface as the Supabase book store. */
function world({ orders = [] } = {}) {
  const db = {
    books: [
      { id: 'b1', created_by: 'user_A', cover_image: PUB('generated/a-cover.png'), is_public: true },
      { id: 'b2', created_by: 'user_B', cover_image: PROXY('generated/b-cover.png'), is_public: true },
      { id: 'b3', created_by: 'user_A', cover_image: PROXY('generated/shared.png'), is_public: false },
    ],
    pages: [
      { book_id: 'b1', image_url: PROXY('generated/a-p1.png') },
      { book_id: 'b1', image_url: PUB('generated/legacy-nobody.png') }, // pre-Clerk, no owner
      { book_id: 'b1', image_url: PUB('generated/b-cover.png') }, // A planted a link to B's file
      { book_id: 'b1', image_url: PROXY('generated/shared.png') }, // also used by A's other book b3
      { book_id: 'b2', image_url: PROXY('generated/b-p1.png') },
    ],
    community: [{ id: 'c1', book_id: 'b1' }, { id: 'c2', book_id: 'b2' }],
    comments: [{ id: 'm1', community_id: 'c1' }, { id: 'm2', community_id: 'c2' }],
    objects: [
      { name: 'generated/a-cover.png', owner: 'user_A' },
      { name: 'generated/a-p1.png', owner: 'user_A' },
      { name: 'generated/legacy-nobody.png', owner: null },
      { name: 'generated/b-cover.png', owner: 'user_B' },
      { name: 'generated/b-p1.png', owner: 'user_B' },
      { name: 'generated/shared.png', owner: 'user_A' },
    ],
    orders: [...orders],
  };
  const removed = [];
  const store = {
    async findBook(id) { return db.books.find((b) => b.id === id) || null; },
    async openOrders(id, uid) { return db.orders.filter((o) => o.book_id === id && o.user_id === uid && ['paid', 'in_production'].includes(o.status)).length; },
    async pageImages(id) { return db.pages.filter((p) => p.book_id === id).map((p) => p.image_url); },
    async setPrivate(id) { db.books.find((b) => b.id === id).is_public = false; },
    async removePosts(id) {
      const ids = db.community.filter((c) => c.book_id === id).map((c) => c.id);
      db.comments = db.comments.filter((m) => !ids.includes(m.community_id));
      db.community = db.community.filter((c) => !ids.includes(c.id));
      return ids.length;
    },
    async removeBookRows(id) { db.pages = db.pages.filter((p) => p.book_id !== id); db.books = db.books.filter((b) => b.id !== id); },
    async stillReferenced(path) {
      const base = path.split('/').pop();
      return db.books.some((b) => b.cover_image?.includes(base) || b.cover_image?.includes(encodeURIComponent(path))) || db.pages.some((p) => p.image_url?.includes(base));
    },
    async ownedFiles(uid) { return new Set(db.objects.filter((o) => o.owner === uid).map((o) => o.name)); },
    async removeFiles(paths) { for (const p of paths) { removed.push(p); db.objects = db.objects.filter((o) => o.name !== p); } },
  };
  return { db, store, removed };
}
const call = (handler, { auth, body, store, method = 'POST' }) => {
  const res = mkRes();
  return handler({ method, headers: {}, body }, res, { auth, store }).then(() => res);
};

test('storagePathFromUrl reads both URL forms and refuses traversal', () => {
  assert.equal(storagePathFromUrl(PUB('generated/x.png')), 'generated/x.png');
  assert.equal(storagePathFromUrl(PROXY('generated/x y.png')), 'generated/x y.png');
  assert.equal(storagePathFromUrl('https://sipurai.ai/api/img?p=generated%2Fx.png'), 'generated/x.png');
  assert.equal(storagePathFromUrl(PUB('generated/a%20b.png')), 'generated/a b.png');
  assert.equal(storagePathFromUrl('https://example.com/pic.png'), null);
  assert.equal(storagePathFromUrl(PROXY('../secret')), null);
  assert.equal(storagePathFromUrl(PROXY('/etc/passwd')), null);
  assert.equal(storagePathFromUrl(null), null);
});

test('unshare: owner allowed - book goes private, its posts and their comments go, others untouched', async () => {
  const w = world();
  const r = await call(unshareHandler, { auth: asUser('user_A'), body: { bookId: 'b1' }, store: w.store });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.removedPosts, 1);
  assert.equal(w.db.books.find((b) => b.id === 'b1').is_public, false);
  assert.deepEqual(w.db.community.map((c) => c.id), ['c2']);
  assert.deepEqual(w.db.comments.map((c) => c.id), ['m2']);
  assert.ok(w.db.books.find((b) => b.id === 'b2').is_public, 'B\'s book stays public');
});

test('unshare: another user is refused and nothing changes', async () => {
  const w = world();
  const r = await call(unshareHandler, { auth: asUser('user_B'), body: { bookId: 'b1' }, store: w.store });
  assert.equal(r.code, 404);
  assert.equal(w.db.books.find((b) => b.id === 'b1').is_public, true);
  assert.equal(w.db.community.length, 2);
});

test('unshare + delete: anonymous is refused before any store is touched', async () => {
  for (const h of [unshareHandler, deleteHandler]) {
    const w = world();
    const r = await call(h, { auth: noUser, body: { bookId: 'b1' }, store: { ...w.store, findBook: () => { throw new Error('store touched'); } } });
    assert.equal(r.code, 401);
    assert.equal(w.db.books.length, 3);
  }
});

test('methods: GET is refused, OPTIONS answers', async () => {
  const w = world();
  assert.equal((await call(deleteHandler, { auth: asUser('user_A'), body: {}, store: w.store, method: 'GET' })).code, 405);
  assert.equal((await call(deleteHandler, { auth: asUser('user_A'), body: {}, store: w.store, method: 'OPTIONS' })).code, 204);
});

test('delete: owner allowed - rows gone, own unshared files removed, a planted link to B\'s file and a file still used elsewhere are kept', async () => {
  const w = world();
  const r = await call(deleteHandler, { auth: asUser('user_A'), body: { bookId: 'b1' }, store: w.store });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.deepEqual(w.removed.sort(), ['generated/a-cover.png', 'generated/a-p1.png']);
  assert.ok(w.db.objects.some((o) => o.name === 'generated/b-cover.png'), 'B\'s file must survive a planted link');
  assert.ok(w.db.objects.some((o) => o.name === 'generated/shared.png'), 'file still used by A\'s other book must survive');
  assert.ok(w.db.objects.some((o) => o.name === 'generated/legacy-nobody.png'), 'ownerless file is not provably A\'s');
  assert.ok(!w.db.books.some((b) => b.id === 'b1'));
  assert.ok(!w.db.pages.some((p) => p.book_id === 'b1'));
  assert.deepEqual(w.db.community.map((c) => c.id), ['c2']);
  assert.deepEqual(w.db.comments.map((c) => c.id), ['m2']);
  assert.ok(w.db.books.some((b) => b.id === 'b2') && w.db.books.some((b) => b.id === 'b3'), 'other books untouched');
});

test('delete: another user is refused; nothing deleted anywhere', async () => {
  const w = world();
  const r = await call(deleteHandler, { auth: asUser('user_B'), body: { bookId: 'b1' }, store: w.store });
  assert.equal(r.code, 404);
  assert.equal(w.db.books.length, 3);
  assert.equal(w.removed.length, 0);
});

test('delete: body cannot pick the user, and junk ids are refused', async () => {
  const w = world();
  assert.equal((await call(deleteHandler, { auth: asUser('user_B'), body: { bookId: 'b1', userId: 'user_A', created_by: 'user_A' }, store: w.store })).code, 404);
  assert.equal((await call(deleteHandler, { auth: asUser('user_A'), body: { bookId: { $ne: 1 } }, store: w.store })).code, 400);
  assert.equal((await call(deleteHandler, { auth: asUser('user_A'), body: {}, store: w.store })).code, 400);
});

test('delete: an open print order blocks it and nothing changes', async () => {
  const w = world({ orders: [{ book_id: 'b1', user_id: 'user_A', status: 'in_production' }] });
  const r = await call(deleteHandler, { auth: asUser('user_A'), body: { bookId: 'b1' }, store: w.store });
  assert.equal(r.code, 409);
  assert.equal(r.body.error.code, 'open_order');
  assert.ok(w.db.books.some((b) => b.id === 'b1'));
  assert.equal(w.removed.length, 0);
});

test('delete: a database failure before the rows are gone leaves the book (error in Hebrew, retry safe)', async () => {
  const w = world();
  w.store.removeBookRows = async () => { throw new Error('boom'); };
  const r = await deleteBook({ userId: 'user_A', bookId: 'b1', store: w.store });
  assert.equal(r.http, 500);
  assert.match(r.body.error.message_he, /אפשר ללחוץ שוב/);
  assert.ok(w.db.books.some((b) => b.id === 'b1'));
  assert.equal(w.removed.length, 0);
});

test('delete: a storage failure after the rows are gone reports success with a warning (the book is gone)', async () => {
  const w = world();
  w.store.removeFiles = async () => { throw new Error('storage down'); };
  const r = await deleteBook({ userId: 'user_A', bookId: 'b1', store: w.store });
  assert.equal(r.http, 200);
  assert.equal(r.body.warning, 'files_left');
  assert.ok(!w.db.books.some((b) => b.id === 'b1'));
});

test('unshare: failure is reported, not swallowed', async () => {
  const w = world();
  w.store.removePosts = async () => { throw new Error('boom'); };
  const r = await unshareBook({ userId: 'user_A', bookId: 'b1', store: w.store });
  assert.equal(r.http, 500);
});
