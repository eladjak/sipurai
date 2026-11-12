import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validPath } from '../api/img.js';
import { pathFromStoredUrl } from '../api/_lib/imageStore.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.body = b ?? null; return r; };
  return r;
};
const PUB = 'https://x.supabase.co/storage/v1/object/public/sipurai-images/';
const graceSeen = [];
const verify = async (t, opts = {}) => {
  graceSeen.push([t, opts.expiryGraceSec || 0]);
  if (t === 'jwt-user-A') return { ok: true, payload: { sub: 'user_A' } };
  if (t === 'jwt-user-B') return { ok: true, payload: { sub: 'user_B' } };
  // expired token of user_A: only valid when the caller grants a grace window
  if (t === 'jwt-user-A_expired') return (opts.expiryGraceSec || 0) > 0 ? { ok: true, payload: { sub: 'user_A' } } : { ok: false, reason: 'token expired' };
  return { ok: false, reason: 'bad' };
};

/** In-memory world with the same interface as createSupabaseImageStore. */
function world() {
  const owners = {
    'generated/a-own.png': 'user_A', 'generated/legacy.png': null, 'generated/pub.png': 'user_A',
    'generated/b-private.png': 'user_B', 'generated/legacy-pub.png': null, 'generated/legacy-null.png': null,
  };
  const rows = {
    'generated/legacy.png': [{ table: 'pages', is_public: false, book_created_by: 'user_A' }],
    'generated/pub.png': [{ table: 'books', is_public: true, book_created_by: 'user_A' }],
    // attacker A planted B's path on A's own public book / page
    'generated/b-private.png': [{ table: 'books', is_public: true, book_created_by: 'user_A' }, { table: 'pages', is_public: true, book_created_by: 'user_A' }],
    // owner-less object that a public book references
    'generated/legacy-pub.png': [{ table: 'books', is_public: true, book_created_by: 'user_A' }],
    // null === null must not count as a match
    'generated/legacy-null.png': [{ table: 'books', is_public: true, book_created_by: null }],
  };
  const calls = [];
  return {
    calls,
    async objectOwner(p) { calls.push(['owner', p]); return owners[p] ?? null; },
    async referencingRows(p) { calls.push(['rows', p]); return rows[p] || []; },
    async download(p) { calls.push(['download', p]); return p in owners ? { bytes: Buffer.from('PNGDATA'), contentType: 'image/png' } : null; },
  };
}
const get = (p, { token, cookie, store = world() } = {}) => {
  const res = mkRes();
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  return handler({ method: 'GET', query: { p }, headers }, res, { verify, store }).then(() => ({ res, store }));
};

test('owner (storage owner) gets the bytes with private cache headers', async () => {
  const { res } = await get('generated/a-own.png', { token: 'jwt-user-A' });
  assert.equal(res.code, 200);
  assert.equal(String(res.body), 'PNGDATA');
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['Cache-Control'], 'private, max-age=3600');
  assert.match(res.headers.Vary, /Cookie/);
});

test('owner identified by the __session cookie works too', async () => {
  const { res } = await get('generated/a-own.png', { cookie: 'foo=1; __session=jwt-user-A; bar=2' });
  assert.equal(res.code, 200);
});

test('another user gets 404, and no bytes are read', async () => {
  const { res, store } = await get('generated/a-own.png', { token: 'jwt-user-B' });
  assert.equal(res.code, 404);
  assert.equal(res.body, null);
  assert.ok(!store.calls.some((c) => c[0] === 'download'));
});

test('anonymous on a private image gets 404', async () => {
  const { res } = await get('generated/a-own.png');
  assert.equal(res.code, 404);
});

test('anonymous on an image of a public book gets 200 with public cache', async () => {
  const { res } = await get('generated/pub.png');
  assert.equal(res.code, 200);
  assert.equal(res.headers['Cache-Control'], 'private, max-age=600');
});

test('owner-less (legacy) object is never served: not to a row creator, not to anonymous, not via a public book', async () => {
  for (const p of ['generated/legacy.png', 'generated/legacy-pub.png', 'generated/legacy-null.png']) {
    for (const o of [{ token: 'jwt-user-A' }, { token: 'jwt-user-B' }, {}]) {
      const { res, store } = await get(p, o);
      assert.equal(res.code, 404, p);
      assert.ok(!store.calls.some((c) => c[0] === 'download'));
    }
  }
});

test('planted reference: another owner\'s path on the attacker\'s own public book returns 404 (anonymous, attacker, victim-less)', async () => {
  for (const o of [{}, { token: 'jwt-user-A' }]) {
    const { res, store } = await get('generated/b-private.png', o);
    assert.equal(res.code, 404);
    assert.equal(res.body, null);
    assert.ok(!store.calls.some((c) => c[0] === 'download'));
  }
  // the real owner still gets it
  assert.equal((await get('generated/b-private.png', { token: 'jwt-user-B' })).res.code, 200);
});

test('Bearer token past exp is anonymous (no grace); cookie gets a 1 hour grace only', async () => {
  graceSeen.length = 0;
  const bearer = await get('generated/a-own.png', { token: 'jwt-user-A_expired' });
  assert.equal(bearer.res.code, 404);
  assert.deepEqual(graceSeen[0], ['jwt-user-A_expired', 0]);
  const pub = await get('generated/pub.png', { token: 'jwt-user-A_expired' });
  assert.equal(pub.res.headers['Cache-Control'], 'private, max-age=600'); // served as public book, not as owner
  graceSeen.length = 0;
  const cookie = await get('generated/a-own.png', { cookie: '__session=jwt-user-A_expired' });
  assert.equal(cookie.res.code, 200);
  assert.deepEqual(graceSeen[0], ['jwt-user-A_expired', 3600]);
});

test('path traversal and odd paths are rejected before any lookup', async () => {
  for (const p of ['generated/../uploads/x.png', '../etc/passwd', 'generated/..%2Fx', 'other/x.png', '/generated/x.png',
    'generated/a b.png', 'generated//x.png', 'generated/x.png\n', 'generated/' + 'a'.repeat(400), '', undefined, ['generated/a.png', 'x']]) {
    const { res, store } = await get(p, { token: 'jwt-user-A' });
    assert.equal(res.code, 404, String(p));
    assert.equal(store.calls.length, 0, `no lookup for ${String(p)}`);
  }
  assert.equal(validPath('generated/ok-1.v2.png'), true);
});

test('bad token is treated as anonymous: private 404, public image still 200', async () => {
  assert.equal((await get('generated/a-own.png', { token: 'garbage' })).res.code, 404);
  assert.equal((await get('generated/pub.png', { token: 'garbage' })).res.code, 200);
});

test('missing object behind a valid grant is 404, database failure is 503, wrong method 405', async () => {
  const s = world();
  s.referencingRows = async () => [{ table: 'pages', is_public: false, book_created_by: 'user_A' }];
  assert.equal((await get('generated/none.png', { token: 'jwt-user-A', store: s })).res.code, 404);
  const broken = world();
  broken.objectOwner = async () => { throw new Error('db down'); };
  assert.equal((await get('generated/a-own.png', { token: 'jwt-user-A', store: broken })).res.code, 503);
  const res = mkRes();
  await handler({ method: 'POST', query: {}, headers: {} }, res, { store: world() });
  assert.equal(res.code, 405);
});

test('pathFromStoredUrl understands both stored forms and exact paths only', () => {
  assert.equal(pathFromStoredUrl(PUB + 'generated/a.png'), 'generated/a.png');
  assert.equal(pathFromStoredUrl('/api/img?p=generated%2Fa.png'), 'generated/a.png');
  assert.equal(pathFromStoredUrl('https://elsewhere.test/a.png'), null);
  assert.notEqual(pathFromStoredUrl(PUB + 'generated/a_b.png'), 'generated/aXb.png');
});
