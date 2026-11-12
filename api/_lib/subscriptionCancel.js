/**
 * Cancel the signed-in parent's subscription online (Israeli Consumer Protection Law s.14T).
 *
 * Endpoint confirmed in Creem's API reference (docs.creem.io/api-reference/endpoint/cancel-subscription):
 *   POST https://api.creem.io/v1/subscriptions/{id}/cancel   header x-api-key   body {mode, onExecute}
 * We send mode "immediate": the subscription stops at once, so it is certainly over within the 3 business days
 * the page promises, and nothing is charged after it.
 * Who: the verified Clerk sub -> profiles.email -> subscriptions row. The body is never consulted.
 */
const ENDED = ['canceled', 'cancelled', 'expired', 'inactive'];

export const SUB_MESSAGES = {
  none: 'לא מצאנו אצלכם מנוי פעיל. אם שילמתם ואתם חושבים שזו טעות, כתבו לנו ל-support@sipurai.ai.',
  notConfigured: 'ביטול אונליין עדיין לא פעיל. כתבו לנו ל-support@sipurai.ai ונבטל בשבילכם.',
  providerFailed: 'הביטול לא הושלם אצל חברת התשלומים. לא בוטל כלום, אפשר ללחוץ שוב. אם זה חוזר, כתבו ל-support@sipurai.ai.',
  failed: 'לא הצלחנו לבדוק את המנוי כרגע. נסו שוב בעוד רגע.',
};

const isActive = (s) => !!s && s.plan && s.plan !== 'free' && !ENDED.includes(String(s.status || '').toLowerCase());

export function createSupabaseSubscriptionStore(db) {
  return {
    async activeSubscription(userId) {
      const p = await db.from('profiles').select('email').eq('clerk_id', userId).limit(1);
      if (p.error) throw new Error(`profile: ${p.error.message}`);
      const email = p.data?.[0]?.email;
      if (!email) return null;
      for (const e of [...new Set([email, String(email).toLowerCase()])]) {
        const { data, error } = await db.from('subscriptions').select('plan,status,current_period_end,creem_subscription_id').eq('user_email', e);
        if (error) throw new Error(`subscriptions: ${error.message}`);
        const hit = (data || []).find(isActive);
        if (hit) return hit;
      }
      return null;
    },
  };
}

const err = (http, code, message_he) => ({ http, body: { error: { code, message_he } } });

export async function subscriptionStatus({ userId, store }) {
  if (!userId) return err(401, 'unauthorized', 'נדרשת התחברות');
  try {
    const s = await store.activeSubscription(userId);
    return { http: 200, body: { active: !!s, plan: s?.plan || null, periodEnd: s?.current_period_end || null } };
  } catch (e) {
    console.error('[subscription/status]', String(e?.message).slice(0, 160));
    return err(500, 'status_failed', SUB_MESSAGES.failed);
  }
}

export async function cancelSubscription({ userId, store, env = {}, fetchImpl = globalThis.fetch }) {
  if (!userId) return err(401, 'unauthorized', 'נדרשת התחברות');
  if (!env.CREEM_API_KEY) return err(503, 'not_configured', SUB_MESSAGES.notConfigured);
  try {
    const s = await store.activeSubscription(userId);
    if (!s) return err(404, 'no_subscription', SUB_MESSAGES.none);
    if (!s.creem_subscription_id) return err(409, 'cannot_cancel_online', SUB_MESSAGES.notConfigured);
    const base = env.CREEM_API_BASE || 'https://api.creem.io';
    const res = await fetchImpl(`${base}/v1/subscriptions/${encodeURIComponent(s.creem_subscription_id)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.CREEM_API_KEY },
      body: JSON.stringify({ mode: 'immediate' }),
    });
    if (!res.ok) {
      console.error('[subscription/cancel] creem answered', res.status);
      return err(502, 'provider_failed', SUB_MESSAGES.providerFailed);
    }
    return { http: 200, body: { ok: true, cancelledAt: new Date().toISOString() } };
  } catch (e) {
    console.error('[subscription/cancel]', String(e?.message).slice(0, 160));
    return err(500, 'cancel_failed', SUB_MESSAGES.providerFailed);
  }
}
