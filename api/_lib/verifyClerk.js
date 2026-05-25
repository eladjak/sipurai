/**
 * Dependency-free Clerk session-JWT verification for Vercel serverless routes.
 *
 * Clerk session tokens are RS256-signed JWTs. We verify the signature against
 * Clerk's JWKS (fetched from the Frontend API, cached in module memory) and
 * check exp / nbf / iss / azp. This lets the AI proxy routes reject
 * unauthenticated callers so anonymous visitors cannot burn Gemini/OpenAI quota.
 *
 * No external deps — uses Node's built-in `crypto`.
 *
 * CONFIG (env-driven — the production-correct approach; set via `vercel env add`,
 * NOT hardcoded so the code is not coupled to one Clerk instance):
 *   CLERK_ISSUER             e.g. https://clerk.sipurai.ai   (preferred)
 *   CLERK_PUBLISHABLE_KEY    pk_live_... / pk_test_...        (issuer derived from it)
 *   VITE_CLERK_PUBLISHABLE_KEY  same, client-side name (also accepted)
 *   CLERK_JWKS_URL           explicit override of the JWKS endpoint (optional)
 *   CLERK_AUTHORIZED_PARTIES comma-separated azp allowlist (optional; defaults to
 *                            the publishable key when available)
 *
 * A safe last-resort fallback issuer (the project's PUBLIC Clerk Frontend API) is
 * used ONLY if no env is configured, so the route never silently fails closed in
 * a misconfigured deploy. The issuer is a public value (embedded in the public
 * pk_live_ key shipped to every browser), so this is not a secret leak — it is a
 * defense-in-depth default, not the primary config path.
 *
 * Returns { ok: true, payload } on success, or { ok: false, reason } on failure.
 */

import { createPublicKey, createVerify } from 'node:crypto';

const JWKS_TTL_MS = 60 * 60 * 1000; // 1h
let _jwksCache = { url: null, keys: null, fetchedAt: 0 };

// Public, non-secret dev-only fallback (this project's Clerk Frontend API /
// issuer). The same value is encoded in the public VITE_CLERK_PUBLISHABLE_KEY.
// Council-of-sages 3-of-3 (2026-05-25) flagged using this unconditionally as a
// fail-OPEN / cross-environment risk. It is therefore used ONLY in non-production
// (local dev) and with a loud warning; in production the verifier FAILS CLOSED if
// no issuer is configured via env.
const FALLBACK_ISSUER = 'https://clerk.sipurai.ai';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

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

/** Derive the Clerk Frontend API host from a publishable key (pk_live_/pk_test_). */
function hostFromPublishableKey(pk) {
  const m = (pk || '').match(/^pk_(?:live|test)_(.+)$/);
  if (!m) return null;
  try {
    const host = Buffer.from(m[1], 'base64').toString('utf8').replace(/\$+$/, '');
    return host || null;
  } catch {
    return null;
  }
}

/**
 * The expected issuer (https://<frontend-api>) — env-first. Returns null in
 * production when nothing is configured (fail closed). The hardcoded public
 * fallback is used ONLY in non-production, with a one-time warning.
 */
let _warnedFallback = false;
export function resolveIssuer() {
  if (process.env.CLERK_ISSUER) return process.env.CLERK_ISSUER.replace(/\/+$/, '');
  const pk = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const host = hostFromPublishableKey(pk);
  if (host) return `https://${host}`;
  // No env-derived issuer.
  if (IS_PRODUCTION) return null; // fail closed in production
  if (!_warnedFallback) {
    _warnedFallback = true;
    console.warn(
      '[verifyClerk] No CLERK_ISSUER / CLERK_PUBLISHABLE_KEY configured — using ' +
      `dev fallback issuer ${FALLBACK_ISSUER}. Set CLERK_ISSUER (or ` +
      'CLERK_PUBLISHABLE_KEY) via env in production.'
    );
  }
  return FALLBACK_ISSUER;
}

/** Derive the Clerk JWKS URL — explicit env, else issuer/.well-known/jwks.json. */
function resolveJwksUrl() {
  if (process.env.CLERK_JWKS_URL) return process.env.CLERK_JWKS_URL;
  const issuer = resolveIssuer();
  return issuer ? `${issuer}/.well-known/jwks.json` : null;
}

/**
 * azp allowlist resolution.
 *   - `explicit: true`  => CLERK_AUTHORIZED_PARTIES was set in env. When explicit,
 *     the council requires STRICT enforcement: the token MUST carry azp and it
 *     MUST be in the list (fail closed).
 *   - `explicit: false` => soft default derived from the publishable key. Enforced
 *     only when the token actually carries azp (don't break tokens that omit it).
 */
function resolveAuthorizedParties() {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES;
  if (raw) {
    return { list: raw.split(',').map((s) => s.trim()).filter(Boolean), explicit: true };
  }
  const pk = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  return { list: pk ? [pk] : [], explicit: false };
}

async function fetchJwks(url) {
  // Short timeout + fail-closed: a slow/unreachable JWKS must not hang the route.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.keys) ? json.keys : [];
  } finally {
    clearTimeout(timer);
  }
}

async function getJwks(url, { force = false } = {}) {
  const now = Date.now();
  if (!force && _jwksCache.keys && _jwksCache.url === url && now - _jwksCache.fetchedAt < JWKS_TTL_MS) {
    return _jwksCache.keys;
  }
  const keys = await fetchJwks(url);
  _jwksCache = { url, keys, fetchedAt: now };
  return keys;
}

function jwkToPem(jwk) {
  // Node can import a JWK directly into a KeyObject and export SPKI PEM.
  const keyObj = createPublicKey({ key: jwk, format: 'jwk' });
  return keyObj.export({ type: 'spki', format: 'pem' });
}

function verifySignature(jwk, signingInput, signature) {
  const pem = jwkToPem(jwk);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(pem, b64urlToBuffer(signature));
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
  if (header.typ && header.typ !== 'JWT') return { ok: false, reason: `unexpected typ ${header.typ}` };

  const jwksUrl = resolveJwksUrl();
  if (!jwksUrl) return { ok: false, reason: 'JWKS url not configured' };

  // --- Signature (with key-rotation handling: refresh on kid miss) ---
  let keys;
  try {
    keys = await getJwks(jwksUrl);
  } catch (e) {
    return { ok: false, reason: `jwks error: ${e.message}` };
  }
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && header.kid) {
    // kid not in the cached set — Clerk may have rotated keys. Force one refresh.
    try {
      keys = await getJwks(jwksUrl, { force: true });
      jwk = keys.find((k) => k.kid === header.kid);
    } catch (e) {
      return { ok: false, reason: `jwks refresh error: ${e.message}` };
    }
  }
  if (!jwk) jwk = keys[0];
  if (!jwk) return { ok: false, reason: 'no matching signing key' };

  let verified = false;
  try {
    verified = verifySignature(jwk, signingInput, signature);
  } catch (e) {
    return { ok: false, reason: `verify error: ${e.message}` };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };

  // --- Standard time checks (allow 30s clock skew). exp is REQUIRED — a session
  // token with no expiry is rejected (fail closed; council Q3 hardening). ---
  const now = Math.floor(Date.now() / 1000);
  const skew = 30;
  if (typeof payload.exp !== 'number') return { ok: false, reason: 'no exp claim' };
  if (payload.exp + skew < now) return { ok: false, reason: 'token expired' };
  if (typeof payload.nbf === 'number' && payload.nbf - skew > now) {
    return { ok: false, reason: 'token not yet valid' };
  }
  if (typeof payload.iat === 'number' && payload.iat - skew > now) {
    return { ok: false, reason: 'token issued in the future' };
  }
  if (!payload.sub) return { ok: false, reason: 'no subject claim' };

  // --- Issuer check — REQUIRED present + exact match (council Q3: fail closed,
  // not "match-if-present"). In production resolveIssuer() returns null when no
  // env issuer is configured, so a misconfigured deploy rejects everything
  // rather than silently accepting any issuer. ---
  const expectedIssuer = resolveIssuer();
  if (!expectedIssuer) return { ok: false, reason: 'issuer not configured (fail closed)' };
  if (!payload.iss) return { ok: false, reason: 'no issuer claim' };
  if (payload.iss.replace(/\/+$/, '') !== expectedIssuer) {
    return { ok: false, reason: 'issuer mismatch' };
  }

  // --- Authorized-party (azp) check — Clerk's recommended hardening. azp holds
  // the publishable key of the frontend the token was minted for.
  //   * EXPLICIT allowlist (CLERK_AUTHORIZED_PARTIES set): STRICT — the token
  //     MUST carry azp AND it must be in the list (fail closed; council Q3).
  //   * SOFT default (derived from the publishable key): enforce only when the
  //     token actually carries azp, so we never break tokens that omit it. ---
  const azp = resolveAuthorizedParties();
  if (azp.explicit) {
    if (!payload.azp) return { ok: false, reason: 'no azp claim (required)' };
    if (!azp.list.includes(payload.azp)) return { ok: false, reason: 'unauthorized party (azp)' };
  } else if (azp.list.length && payload.azp && !azp.list.includes(payload.azp)) {
    return { ok: false, reason: 'unauthorized party (azp)' };
  }

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
