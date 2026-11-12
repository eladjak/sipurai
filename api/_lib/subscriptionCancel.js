/**
 * Cancel the signed-in parent's subscription online (Israeli Consumer Protection Law s.14T).
 *
 * Endpoint confirmed in Creem's API reference (docs.creem.io/api-reference/endpoint/cancel-subscription):
 *   POST https://api.creem.io/v1/subscriptions/{id}/cancel   header x-api-key   body {mode, onExecute}
 * We send mode "immediate": the subscription stops at once, so it is certainly over within the 3 business days
 * the page promises, and nothing is charged after it.
 * Who: the email in the VERIFIED Clerk token payload (the route passes it in) -> subscriptions.user_email.
 * profiles.email is NEVER read: the browser writes it and its owner can change it, so it proves nothing.
 * A token without a (verified) email cannot cancel online; the page then points to the email / post route.
 * The body is never consulted.
 */
const ENDED = ['canceled', 'cancelled', 'expired', 'inactive'];

export const SUB_MESSAGES = {
  none: 'לא מצאנו אצלכם מנוי פעיל. אם שילמתם ואתם חושבים שזו טעות, כתבו לנו ל-support@sipurai.ai.',
  notConfigured: 'ביטול אונליין עדיין לא פעיל. כתבו לנו ל-support@sipurai.ai ונבטל בשבילכם.',
  providerFailed: 'הביטול לא הושלם אצל חברת התשלומים. לא בוטל כלום, אפשר ללחוץ שוב. אם זה חוזר, כתבו ל-support@sipurai.ai.',
  uncertain: 'לא קיבלנו תשובה מחברת התשלומים, ולכן ייתכן שהביטול לא הושלם וייתכן שהוא כן הושלם. כדאי לבדוק שוב בעוד כמה דקות, או לכתוב לנו ל-support@sipurai.ai ונבדוק בשבילכם.',
  failed: 'לא הצלחנו לבדוק את המנוי כרגע. נסו שוב בעוד רגע.',
};

const isActive = (s) => !!s && s.plan && s.plan !== 'free' && !ENDED.includes(String(s.status || '').toLowerCase());

/** Email from the verified token payload, or null. An explicitly unverified email counts as absent. */
export function verifiedEmail(payload) {
  const e = payload?.email;
  if (typeof e !== 'string') return null;
  const v = e.trim();
  if (!v || v.length > 254 || !v.includes('@')) return null;
  if (payload.email_verified === false) return null;
  return v;
}

const missingColumn = (error) => !!error && (error.code === '42703' || /creem_subscription_id|column .* does not exist/i.test(String(error.message || '')));

export function createSupabaseSubscriptionStore(db) {
  async function pick(email, cols) {
    for (const e of [...new Set([email, String(email).toLowerCase()])]) {
      const { data, error } = await db.from('subscriptions').select(cols).eq('user_email', e);
      if (error) return { error };
      const hit = (data || []).find(isActive);
      if (hit) return { hit };
    }
    return { hit: null };
  }
  return {
    /**
     * Active subscription of the (verified) email, or null. Reads only subscriptions, never profiles.
     * withCreemId: also ask for creem_subscription_id; if that column does not exist the row comes back with
     * cannotCancelOnline = true instead of an error.
     */
    async activeSubscription(email, { withCreemId = false } = {}) {
      if (!email) return null;
      const base = 'plan,status,current_period_end,user_email';
      if (withCreemId) {
        const r = await pick(email, `${base},creem_subscription_id`);
        if (!r.error) return r.hit;
        if (!missingColumn(r.error)) throw new Error(`subscriptions: ${r.error.message}`);
        const r2 = await pick(email, base);
        if (r2.error) throw new Error(`subscriptions: ${r2.error.message}`);
        return r2.hit ? { ...r2.hit, creem_subscription_id: null, cannotCancelOnline: true } : null;
      }
      const r = await pick(email, base);
      if (r.error) throw new Error(`subscriptions: ${r.error.message}`);
      return r.hit;
    },
  };
}

const err = (http, code, message_he) => ({ http, body: { error: { code, message_he } } });

export async function subscriptionStatus({ userId, email, store }) {
  if (!userId) return err(401, 'unauthorized', 'נדרשת התחברות');
  if (!email) return { http: 200, body: { active: false, online: false, plan: null, periodEnd: null } };
  try {
    const s = await store.activeSubscription(email);
    return { http: 200, body: { active: !!s, online: true, plan: s?.plan || null, periodEnd: s?.current_period_end || null } };
  } catch (e) {
    console.error('[subscription/status]', String(e?.message).slice(0, 160));
    return err(500, 'status_failed', SUB_MESSAGES.failed);
  }
}

const CREEM_TIMEOUT_MS = 15000;

export async function cancelSubscription({ userId, email, store, env = {}, fetchImpl = globalThis.fetch }) {
  if (!userId) return err(401, 'unauthorized', 'נדרשת התחברות');
  if (!env.CREEM_API_KEY) return err(503, 'not_configured', SUB_MESSAGES.notConfigured);
  if (!email) return err(409, 'cannot_cancel_online', SUB_MESSAGES.notConfigured);
  let s;
  try {
    s = await store.activeSubscription(email, { withCreemId: true });
  } catch (e) {
    console.error('[subscription/cancel] lookup:', String(e?.message).slice(0, 160));
    return err(500, 'cancel_failed', SUB_MESSAGES.failed);
  }
  if (!s) return err(404, 'no_subscription', SUB_MESSAGES.none);
  if (s.cannotCancelOnline || !s.creem_subscription_id) return err(409, 'cannot_cancel_online', SUB_MESSAGES.notConfigured);
  const base = env.CREEM_API_BASE || 'https://api.creem.io';
  let res;
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), CREEM_TIMEOUT_MS) : null;
    try {
      res = await fetchImpl(`${base}/v1/subscriptions/${encodeURIComponent(s.creem_subscription_id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.CREEM_API_KEY },
        body: JSON.stringify({ mode: 'immediate' }),
        signal: ctl?.signal,
      });
    } finally { if (timer) clearTimeout(timer); }
  } catch (e) {
    // The request may have reached Creem and been processed: the outcome is UNKNOWN, not "nothing happened".
    console.error('[subscription/cancel] no answer from the payment provider (outcome unknown):', String(e?.name || e?.message).slice(0, 80));
    return err(504, 'provider_uncertain', SUB_MESSAGES.uncertain);
  }
  if (!res.ok) {
    console.error('[subscription/cancel] creem answered', res.status);
    return err(502, 'provider_failed', SUB_MESSAGES.providerFailed);
  }
  return { http: 200, body: { ok: true, cancelledAt: new Date().toISOString() } };
}
