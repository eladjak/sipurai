// Read-only image route accepts a stale Clerk __session cookie (idle tab), capped at 12h.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';

const ISS = 'https://clerk.test.example';
process.env.CLERK_ISSUER = ISS;
process.env.CLERK_JWKS_URL = `${ISS}/.well-known/jwks.json`;
delete process.env.CLERK_AUTHORIZED_PARTIES;

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ keys: [jwk] }) });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload) {
  const head = b64({ alg: 'RS256', typ: 'JWT', kid: 'k1' });
  const body = b64(payload);
  const s = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `${head}.${body}.${s}`;
}
const now = Math.floor(Date.now() / 1000);
const tok = (expAgoSec) => sign({ sub: 'user_1', iss: ISS, iat: now - expAgoSec - 60, exp: now - expAgoSec });

const { verifyClerkToken } = await import('../api/_lib/verifyClerk.js');

test('fresh token is accepted', async () => {
  assert.equal((await verifyClerkToken(tok(-60))).ok, true);
});
test('token 2h past exp is rejected by default (all write routes)', async () => {
  const r = await verifyClerkToken(tok(7200));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'token expired');
});
test('token 2h past exp is accepted with the image grace', async () => {
  assert.equal((await verifyClerkToken(tok(7200), { expiryGraceSec: 12 * 3600 })).ok, true);
});
test('grace is capped at 12h even if a caller asks for more', async () => {
  const r = await verifyClerkToken(tok(13 * 3600), { expiryGraceSec: 999999 });
  assert.equal(r.ok, false);
});
test('grace never rescues a bad signature', async () => {
  const t = tok(60);
  const bad = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal((await verifyClerkToken(bad, { expiryGraceSec: 3600 })).ok, false);
});
