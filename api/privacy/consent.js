// GET  /api/privacy/consent -> { hasConsent, returning, policyVersion }   did this parent accept the current policy?
// POST /api/privacy/consent -> records acceptance { policyVersion, items:{guardian_18,privacy_children_abroad,terms}, locale }
// The user is always the one in the verified Clerk token; nothing in the body can name another user.
import { requireClerkAuth } from '../_lib/verifyClerk.js';
import { CURRENT_POLICY_VERSION } from '../_lib/policyVersion.js';
import { CONSENT_MESSAGES, defaultConsentStore, hasConsent, isReturningParent, recordConsent } from '../_lib/consent.js';

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'method_not_allowed' } });
  }

  const auth = await (overrides.auth || requireClerkAuth)(req);
  const userId = auth?.ok ? auth.payload?.sub : null;
  if (!userId) return res.status(401).json({ error: { code: 'unauthorized', message_he: 'נדרשת התחברות' } });

  try {
    const store = overrides.consentStore || (await defaultConsentStore(overrides.env || process.env));
    if (req.method === 'GET') {
      const ok = await hasConsent({ store, userId });
      const returning = ok ? false : await isReturningParent({ store, userId });
      return res.status(200).json({ hasConsent: ok, returning, policyVersion: CURRENT_POLICY_VERSION });
    }
    const r = await recordConsent({ store, userId, body: req.body, userAgent: req.headers?.['user-agent'] });
    return res.status(r.http).json(r.body);
  } catch (e) {
    console.error('[privacy/consent] failed closed:', String(e?.message).slice(0, 120));
    return res.status(503).json({ error: { code: 'consent_unavailable', message_he: CONSENT_MESSAGES.unavailable } });
  }
}
