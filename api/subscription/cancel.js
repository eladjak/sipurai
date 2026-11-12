// GET  /api/subscription/cancel  -> { active, plan, periodEnd }   (does this signed-in parent have a paid subscription?)
// POST /api/subscription/cancel  -> cancels it at Creem. Who is decided only by the verified Clerk token.
import { requireClerkAuth } from '../_lib/verifyClerk.js';
import { serviceClient } from '../_lib/consent.js';
import { SUB_MESSAGES, cancelSubscription, createSupabaseSubscriptionStore, subscriptionStatus } from '../_lib/subscriptionCancel.js';

const ORIGINS = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];

export default async function handler(req, res, overrides = {}) {
  const origin = req.headers?.origin;
  res.setHeader?.('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });

  const env = overrides.env || process.env;
  const auth = await (overrides.auth || requireClerkAuth)(req);
  const userId = auth?.ok ? auth.payload?.sub : null;
  if (!userId) return res.status(401).json({ error: { code: 'unauthorized', message_he: 'נדרשת התחברות' } });

  let store = overrides.store;
  if (!store) {
    try {
      store = createSupabaseSubscriptionStore(await serviceClient(env));
    } catch (e) {
      console.error('[subscription] no database:', String(e?.message).slice(0, 120));
      return res.status(503).json({ error: { code: 'unavailable', message_he: SUB_MESSAGES.failed } });
    }
  }
  const r = req.method === 'GET'
    ? await subscriptionStatus({ userId, store })
    : await cancelSubscription({ userId, store, env, fetchImpl: overrides.fetchImpl });
  return res.status(r.http).json(r.body);
}
