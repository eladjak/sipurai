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
const verify = async (t) => (t === 'tok_A' ? { ok: true, payload: { sub: 'user_A' } }
  : t === 'tok_B' ? { ok: true, payload: { sub: 'user_B' } } : { ok: false, reason: 'bad' });

/** In-memory world with the same interface as createSupabaseImageStore. */
function world() {
  const owners = { 'generated/a-own.png': 'user_A', 'generated/legacy.png': null, 'generated/pub.png': 'user_A' };
  const rows = {
    'generated/legacy.png': [{ table: 'pages', created_by: 'user_A', is_public: false }],
    'generated/pub.png': [{ table: 'books', created_by: 'user_A', is_public: true }],
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
  const { res } = await get('generated/a-own.png', { token: 'tok_A' });
  assert.equal(res.code, 200);
  assert.equal(String(res.body), 'PNGDATA');
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['Cache-Control'], 'private, max-age=3600');
  assert.match(res.headers.Vary, /Cookie/);
});

test('owner identified by the __session cookie works too', async () => {
  const { res } = await get('generated/a-own.png', { cookie: 'foo=1; __session=tok_A; bar=2' });
  assert.equal(res.code, 200);
});

test('another user gets 404, and no bytes are read', async () => {
  const { res, store } = await get('generated/a-own.png', { token: 'tok_B' });
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
  assert.equal(res.headers['Cache-Control'], 'public, max-age=86400');
});

test('legacy owner-less object is served to the user whose own row references it, not to others', async () => {
  const a = await get('generated/legacy.png', { token: 'tok_A' });
  assert.equal(a.res.code, 200);
  assert.equal(a.res.headers['Cache-Control'], 'private, max-age=3600');
  const b = await get('generated/legacy.png', { token: 'tok_B' });
  assert.equal(b.res.code, 404);
});

test('path traversal and odd paths are rejected before any lookup', async () => {
  for (const p of ['generated/../uploads/x.png', '../etc/passwd', 'generated/..%2Fx', 'other/x.png', '/generated/x.png',
    'generated/a b.png', 'generated//x.png', 'generated/x.png\n', 'generated/' + 'a'.repeat(400), '', undefined, ['generated/a.png', 'x']]) {
    const { res, store } = await get(p, { token: 'tok_A' });
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
  s.referencingRows = async () => [{ table: 'pages', created_by: 'user_A', is_public: false }];
  assert.equal((await get('generated/none.png', { token: 'tok_A', store: s })).res.code, 404);
  const broken = world();
  broken.objectOwner = async () => { throw new Error('db down'); };
  assert.equal((await get('generated/a-own.png', { token: 'tok_A', store: broken })).res.code, 503);
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
