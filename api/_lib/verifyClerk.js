/**
 * Dependency-free Clerk session-JWT verification for Vercel serverless routes.
 *
 * Clerk session tokens are RS256-signed JWTs. We verify the signature against
 * Clerk's JWKS (fetched from the Frontend API, cached in module memory) and
 * check exp / nbf. This lets the AI proxy routes reject unauthenticated callers
 * so anonymous visitors cannot burn Gemini/OpenAI quota.
 *
 * No external deps — uses Node's built-in `crypto`. The Frontend API host is
 * derived from the Clerk publishable key (CLERK_PUBLISHABLE_KEY /
 * VITE_CLERK_PUBLISHABLE_KEY), or overridden via CLERK_JWKS_URL.
 *
 * Returns { ok: true, payload } on success, or { ok: false, reason } on failure.
 */

import { createPublicKey, createVerify } from 'node:crypto';

const JWKS_TTL_MS = 60 * 60 * 1000; // 1h
let _jwksCache = { url: null, keys: null, fetchedAt: 0 };

function b64urlToBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(b64urlToBuffer(parts[0]).toString('utf8'));
    const payload = JSON.parse(b64urlToBuffer(parts[1]).toString('utf8'));
    return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
  } catch {
    return null;
  }
}

/** Derive the Clerk JWKS URL from env (publishable key) or explicit override. */
function resolveJwksUrl() {
  if (process.env.CLERK_JWKS_URL) return process.env.CLERK_JWKS_URL;
  const pk =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  // pk_live_<base64(frontendApiHost + '$')>  /  pk_test_<...>
  const m = pk.match(/^pk_(?:live|test)_(.+)$/);
  if (!m) return null;
  let host;
  try {
    host = Buffer.from(m[1], 'base64').toString('utf8').replace(/\$+$/, '');
  } catch {
    return null;
  }
  if (!host) return null;
  return `https://${host}/.well-known/jwks.json`;
}

async function getJwks(url) {
  const now = Date.now();
  if (_jwksCache.keys && _jwksCache.url === url && now - _jwksCache.fetchedAt < JWKS_TTL_MS) {
    return _jwksCache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const json = await res.json();
  const keys = Array.isArray(json.keys) ? json.keys : [];
  _jwksCache = { url, keys, fetchedAt: now };
  return keys;
}

function jwkToPem(jwk) {
  // Node can import a JWK directly into a KeyObject and export SPKI PEM.
  const keyObj = createPublicKey({ key: jwk, format: 'jwk' });
  return keyObj.export({ type: 'spki', format: 'pem' });
}

/**
 * Verify a Clerk session JWT.
 * @param {string} token raw JWT (no "Bearer " prefix)
 * @returns {Promise<{ok:true,payload:object}|{ok:false,reason:string}>}
 */
export async function verifyClerkToken(token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing token' };

  const decoded = decodeJwt(token);
  if (!decoded) return { ok: false, reason: 'malformed token' };

  const { header, payload, signingInput, signature } = decoded;
  if (header.alg !== 'RS256') return { ok: false, reason: `unsupported alg ${header.alg}` };

  const jwksUrl = resolveJwksUrl();
  if (!jwksUrl) return { ok: false, reason: 'JWKS url not configured' };

  let keys;
  try {
    keys = await getJwks(jwksUrl);
  } catch (e) {
    return { ok: false, reason: `jwks error: ${e.message}` };
  }

  const jwk = keys.find((k) => k.kid === header.kid) || keys[0];
  if (!jwk) return { ok: false, reason: 'no matching signing key' };

  let verified = false;
  try {
    const pem = jwkToPem(jwk);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    verified = verifier.verify(pem, b64urlToBuffer(signature));
  } catch (e) {
    return { ok: false, reason: `verify error: ${e.message}` };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };

  // Standard time checks (allow 30s clock skew).
  const now = Math.floor(Date.now() / 1000);
  const skew = 30;
  if (typeof payload.exp === 'number' && payload.exp + skew < now) {
    return { ok: false, reason: 'token expired' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf - skew > now) {
    return { ok: false, reason: 'token not yet valid' };
  }
  if (!payload.sub) return { ok: false, reason: 'no subject claim' };

  return { ok: true, payload };
}

/**
 * Express/Vercel helper: pull the bearer token from the request and verify it.
 * Returns the same shape as verifyClerkToken. On `{ ok:false }` the caller
 * should respond 401.
 */
export async function requireClerkAuth(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return { ok: false, reason: 'no bearer token' };
  return verifyClerkToken(m[1]);
}
