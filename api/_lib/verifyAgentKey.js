/**
 * Agent API authentication for Sipurai's serverless routes.
 *
 * The agent-facing namespace (`/api/agent/*`) is a SECOND front door to Sipurai
 * for external agents (Kami / Box / Solis / any Claude / OpenClaw instance) so a
 * person can command the app by voice/text — e.g. "תכין סיפור על ארנב אמיץ ושלח
 * לי בוואטסאפ" — without opening the UI.
 *
 * This is SEPARATE from the Clerk session-JWT auth used by the human-facing
 * `/api/ai/*` routes (see `verifyClerk.js`). An external agent has no Clerk
 * session; it presents a static bearer token that must match `SIPURAI_AGENT_KEY`.
 *
 * Security notes:
 * - The secret is read ONLY from the environment. Nothing is hardcoded.
 * - `AGENT_API_TOKEN` is accepted as a documented alias; `SIPURAI_AGENT_KEY` wins.
 * - Comparison is constant-time (timingSafeEqual) to avoid timing oracles.
 * - The API FAILS CLOSED (HTTP 503) when no key is configured, so an
 *   unconfigured deploy never exposes the agent endpoints to the open internet.
 *
 * No external deps — uses Node's built-in `crypto`.
 *
 * Returns { ok: true } on success, or { ok: false, status, error } otherwise.
 */

import { timingSafeEqual } from 'node:crypto';

/** Read the configured agent key (SIPURAI_AGENT_KEY preferred, AGENT_API_TOKEN alias). */
export function getAgentKey() {
  return (
    process.env.SIPURAI_AGENT_KEY?.trim() ||
    process.env.AGENT_API_TOKEN?.trim() ||
    undefined
  );
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison against a fixed-length buffer so timing does not
    // leak the secret length, then return false.
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify the `Authorization: Bearer <token>` header against `SIPURAI_AGENT_KEY`.
 *
 * @param {import('http').IncomingMessage} req Vercel/Express-style request.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function verifyAgentRequest(req) {
  const configuredKey = getAgentKey();

  // No key configured → agent API is disabled. Fail closed.
  if (!configuredKey) {
    return {
      ok: false,
      status: 503,
      error:
        'ממשק הסוכנים אינו מופעל (SIPURAI_AGENT_KEY לא הוגדר). הגדירו מפתח בשרת.',
    };
  }

  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const presented = match?.[1]?.trim();

  if (!presented) {
    return {
      ok: false,
      status: 401,
      error: 'חסר אסימון הרשאה. שלחו כותרת Authorization: Bearer <token>.',
    };
  }

  if (!safeEqual(presented, configuredKey)) {
    return { ok: false, status: 403, error: 'אסימון הרשאה שגוי.' };
  }

  return { ok: true };
}
