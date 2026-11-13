/**
 * "סוכן" agent identity for Sipurai admin endpoints (owner decision 12.11.2026).
 *
 * An agent key is an alternative to a Clerk admin session for the SAME admin endpoints
 * (/api/orders/admin-list, /api/orders/admin-action) - the rights ADMIN-listed Clerk ids have there,
 * nothing more. It does not touch the Clerk verifier.
 *
 *   Key shape:   sagent_<64 hex>             (raw key lives only in the vault file on the server)
 *   Server env:  SIPURAI_AGENT_KEY_SHA256   (hex sha256 of the raw key; the raw key is never in Vercel)
 *   Revoke:      delete/blank the env var (instant 401 for the key). Rotate: replace with the new hash.
 *
 * Guard rails: actions that move money / contact a customer / delete need
 *   X-Agent-Confirm: <encodeURIComponent(text)>   (>= 20 chars)   else 428 {error:'agent_confirm_required', class}.
 * 60 state-changing calls per minute per key (429). Every guarded action is written to table agent_audit
 * BEFORE it runs; if the audit row cannot be written the action does not run (503).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

// Display name shown in audit rows / event actors. Override with SIPURAI_AGENT_DISPLAY_NAME; default is neutral.
export const AGENT_DISPLAY_NAME = (process.env.SIPURAI_AGENT_DISPLAY_NAME || '').trim() || 'סוכן';
export const KEY_PREFIX = 'sagent_';
export const CONFIRM_MIN_CHARS = 20;
export const WRITES_PER_MINUTE = 60;

/** admin-action name -> guard class */
export const ACTION_CLASS = Object.freeze({
  retry_submit: 'money', // re-submits a paid order to the print vendor (spends vendor money)
  cancel: 'delete',
  mark_shipped: 'send', // customer-visible status change
  mark_ready_for_pickup: 'send',
});

const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest();

/** -> {present:false} | {present:true, ok:boolean}. present=false means "not an agent attempt". */
export function verifyAgentKey(req, env) {
  const h = req?.headers?.authorization || req?.headers?.Authorization || '';
  const m = /^Bearer\s+(\S+)$/.exec(h);
  if (!m || !m[1].startsWith(KEY_PREFIX)) return { present: false };
  const expectedHex = String(env?.SIPURAI_AGENT_KEY_SHA256 || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return { present: true, ok: false }; // not configured: fail closed
  const ok = timingSafeEqual(sha(m[1]), Buffer.from(expectedHex, 'hex'));
  return { present: true, ok };
}

export const CONFIRM_MAX_CHARS = 600;

/** Characters that count for nothing: whitespace, control, format (zero-width, joiners, BOM), combining marks, variation selectors. */
const INVISIBLE = /[\s\p{Cf}\p{Cc}\p{M}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;
export const visibleLength = (text) => [...String(text).replace(INVISIBLE, '')].length;

/**
 * -> {text, reason:null} | {text:null, reason:'missing'|'too_short'|'too_long'}.
 * Counted in code points after removing invisible characters; a text over 600 code points is refused, never truncated.
 */
export function checkAgentConfirm(req) {
  const raw = req?.headers?.['x-agent-confirm'];
  if (!raw || typeof raw !== 'string') return { text: null, reason: 'missing' };
  let text;
  try {
    text = decodeURIComponent(raw).trim();
  } catch {
    return { text: null, reason: 'missing' };
  }
  if ([...text].length > CONFIRM_MAX_CHARS) return { text: null, reason: 'too_long' };
  if (visibleLength(text) < CONFIRM_MIN_CHARS) return { text: null, reason: 'too_short' };
  return { text, reason: null };
}

export function readAgentConfirm(req) {
  return checkAgentConfirm(req).text;
}

const hits = new Map();
/** true = over the limit */
export function writeRateLimited(now = Date.now()) {
  const recent = (hits.get('agent') || []).filter((t) => now - t < 60_000);
  if (recent.length >= WRITES_PER_MINUTE) {
    hits.set('agent', recent);
    return true;
  }
  recent.push(now);
  hits.set('agent', recent);
  return false;
}
export const resetRateLimitForTests = () => hits.clear();
