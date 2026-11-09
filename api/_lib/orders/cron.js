/** Hourly watcher for stuck print orders. Bearer CRON_SECRET, fail closed. */
import crypto from 'node:crypto';
import { defaultDeps, isEnabled } from './handlers.js';
import { reconcileAwaitingPayments, runStuckWatch, sanitize } from './service.js';

function secretMatches(header, secret) {
  if (!secret) return false; // env missing -> nobody gets in
  const m = /^Bearer\s+(.+)$/i.exec(header || '');
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function watchHandler() {
  return async function handler(req, res, overrides) {
    const env = overrides?.env || process.env;
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });
    if (!isEnabled(env)) return res.status(404).json({ error: { code: 'disabled' } });
    if (!secretMatches(req.headers?.authorization || req.headers?.Authorization, env.CRON_SECRET)) {
      return res.status(401).json({ error: { code: 'unauthorized' } });
    }
    try {
      const deps = overrides?.store ? { env, ...overrides } : { ...(await defaultDeps(env)), ...overrides, env };
      const reconcile = await reconcileAwaitingPayments(deps);
      const out = await runStuckWatch(deps);
      return res.status(200).json(reconcile.skipped ? out : { ...out, reconcile });
    } catch (e) {
      console.error('[print-orders-watch]', sanitize(e?.message));
      return res.status(500).json({ error: { code: 'server_error' } });
    }
  };
}
