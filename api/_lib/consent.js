/**
 * Parental privacy consent: the server half of the privacy gate.
 *
 * The truth lives in Postgres (scripts/migrations/2026-11-10-privacy-consents.sql).
 * Only the service role reads or writes it. The browser asks through /api/privacy/consent,
 * and every AI route that handles a child's story calls requireConsent() before it spends
 * a single token. No consent for the CURRENT policy version -> 403. The store failing -> 503
 * (fails CLOSED: an unchecked call is exactly what this exists to stop).
 *
 * The store is injectable so tests run the same policy against an in-memory fake.
 */
import {
  CURRENT_POLICY_VERSION,
  CONSENT_ITEMS,
  PREVIOUS_POLICY_VERSION,
  PREVIOUS_VERSION_ACCEPTED_UNTIL,
} from './policyVersion.js';

export const CONSENT_MESSAGES = {
  required:
    'מדיניות הפרטיות התעדכנה. רעננו את הדף כדי לאשר את הגרסה החדשה, ואז נמשיך מאותה נקודה.',
  unavailable: 'לא הצלחנו לבדוק את אישור הפרטיות כרגע. נסו שוב בעוד רגע.',
  badBody: 'כדי להמשיך צריך לסמן את שלוש התיבות.',
  staleVersion: 'המדיניות התעדכנה בינתיים. רעננו את הדף ואשרו את הגרסה החדשה.',
  deleting: 'החשבון הזה נמצא בתהליך מחיקה, ולכן אי אפשר לאשר או להמשיך.',
};

const LOCALES = new Set(['he', 'en', 'yi']);

/* ---------------- in-memory store (tests only; same contract as the SQL table) ---------------- */
export function createMemoryConsentStore() {
  const rows = [];
  const deleting = new Set();
  return {
    _rows: rows,
    _deleting: deleting,
    async isDeleting(userId) {
      return deleting.has(userId);
    },
    async has({ userId, policyVersion }) {
      return rows.some((r) => r.user_id === userId && r.policy_version === policyVersion);
    },
    async hasAny({ userId, policyVersions }) {
      return rows.some((r) => r.user_id === userId && policyVersions.includes(r.policy_version));
    },
    async hasOlder({ userId, currentVersion }) {
      return rows.some((r) => r.user_id === userId && r.policy_version !== currentVersion);
    },
    async save({ userId, policyVersion, items, locale, userAgent }) {
      if (!rows.some((r) => r.user_id === userId && r.policy_version === policyVersion)) {
        rows.push({ user_id: userId, policy_version: policyVersion, items, locale, user_agent: userAgent, accepted_at: new Date().toISOString() });
      }
    },
    async deleteAll(userId) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_id === userId) rows.splice(i, 1);
    },
  };
}

/* ---------------- Supabase store (service-role client) ---------------- */
export function createSupabaseConsentStore(db) {
  return {
    async isDeleting(userId) {
      const { data, error } = await db.from('account_deletions').select('user_id').eq('user_id', userId).limit(1);
      if (error) throw new Error(`deletion marker read: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async has({ userId, policyVersion }) {
      const { data, error } = await db
        .from('privacy_consents')
        .select('id')
        .eq('user_id', userId)
        .eq('policy_version', policyVersion)
        .limit(1);
      if (error) throw new Error(`consent read: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async hasAny({ userId, policyVersions }) {
      const { data, error } = await db
        .from('privacy_consents')
        .select('id')
        .eq('user_id', userId)
        .in('policy_version', policyVersions)
        .limit(1);
      if (error) throw new Error(`consent read: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async hasOlder({ userId, currentVersion }) {
      const { data, error } = await db
        .from('privacy_consents')
        .select('id')
        .eq('user_id', userId)
        .neq('policy_version', currentVersion)
        .limit(1);
      if (error) throw new Error(`consent read: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async save({ userId, policyVersion, items, locale, userAgent }) {
      const { error } = await db.from('privacy_consents').upsert(
        { user_id: userId, policy_version: policyVersion, items, locale, user_agent: userAgent },
        { onConflict: 'user_id,policy_version', ignoreDuplicates: true },
      );
      if (error) throw new Error(`consent write: ${error.message}`);
    },
    async deleteAll(userId) {
      const { error } = await db.from('privacy_consents').delete().eq('user_id', userId);
      if (error) throw new Error(`consent delete: ${error.message}`);
    },
  };
}

export async function serviceClient(env = process.env) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase service role not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function defaultConsentStore(env = process.env) {
  return createSupabaseConsentStore(await serviceClient(env));
}

/**
 * Asked on EVERY protected request, never cached. A per-instance cache would let a request through for
 * minutes after the record was removed, and during a database outage, which breaks the two promises
 * "no record -> 403" and "cannot check -> 503". One small indexed read is the price of that.
 */
export async function hasConsent({ store, userId, policyVersion = CURRENT_POLICY_VERSION }) {
  return store.has({ userId, policyVersion });
}

/** True while the previous policy version still opens the AI routes. `now` is injectable for tests. */
export function previousVersionStillAccepted(now = new Date()) {
  return new Date(now).getTime() <= new Date(PREVIOUS_VERSION_ACCEPTED_UNTIL).getTime();
}

/**
 * Gate check for the AI routes: the current version, or the previous one during the grace period.
 * (The browser gate still asks for the current version; this only keeps a story from being cut off.)
 */
export async function hasConsentForAi({ store, userId, now = new Date() }) {
  if (await hasConsent({ store, userId })) return true;
  if (!previousVersionStillAccepted(now)) return false;
  return store.hasAny({ userId, policyVersions: [PREVIOUS_POLICY_VERSION] });
}

/** Has accepted an older version but not the current one: the screen says "the policy was updated". */
export async function isReturningParent({ store, userId }) {
  return store.hasOlder({ userId, currentVersion: CURRENT_POLICY_VERSION });
}

/** Validates what the browser sent. Returns {ok:true, items} or {ok:false, code, message_he}. */
export function validateAcceptance(body = {}) {
  if (String(body.policyVersion || '') !== CURRENT_POLICY_VERSION) {
    return { ok: false, code: 'stale_version', message_he: CONSENT_MESSAGES.staleVersion };
  }
  const given = body.items && typeof body.items === 'object' ? body.items : {};
  if (!CONSENT_ITEMS.every((k) => given[k] === true)) {
    return { ok: false, code: 'items_missing', message_he: CONSENT_MESSAGES.badBody };
  }
  const items = Object.fromEntries(CONSENT_ITEMS.map((k) => [k, true]));
  const locale = LOCALES.has(body.locale) ? body.locale : null;
  return { ok: true, items, locale };
}

export async function recordConsent({ store, userId, body, userAgent }) {
  if (await store.isDeleting(userId)) {
    return { ok: false, http: 409, body: { error: { code: 'account_deleting', message_he: CONSENT_MESSAGES.deleting } } };
  }
  const v = validateAcceptance(body);
  if (!v.ok) return { ok: false, http: 400, body: { error: { code: v.code, message_he: v.message_he } } };
  await store.save({
    userId,
    policyVersion: CURRENT_POLICY_VERSION,
    items: v.items,
    locale: v.locale,
    userAgent: String(userAgent || '').slice(0, 300) || null,
  });
  return { ok: true, http: 200, body: { ok: true, hasConsent: true, policyVersion: CURRENT_POLICY_VERSION } };
}

/**
 * Gate for the AI routes. Returns false to continue, or sends the response and returns true.
 * Always on. 403 when the parent has not accepted the current version; 503 when we cannot tell.
 */
export async function requireConsent(req, res, userId, overrides = {}) {
  try {
    const store = overrides.consentStore || (await defaultConsentStore(overrides.env || process.env));
    if (await hasConsentForAi({ store, userId, now: overrides.now ? new Date(overrides.now) : new Date() })) return false;
    res.status(403).json({ error: CONSENT_MESSAGES.required, code: 'consent_required', policyVersion: CURRENT_POLICY_VERSION });
    return true;
  } catch (e) {
    console.error('[consent] gate failed closed:', String(e?.message).slice(0, 120));
    res.status(503).json({ error: CONSENT_MESSAGES.unavailable, code: 'consent_unavailable' });
    return true;
  }
}
