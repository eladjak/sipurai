/** Hourly watcher for stuck print orders. Bearer CRON_SECRET, fail closed. */
import crypto from 'node:crypto';
import { defaultDeps, isEnabled } from './handlers.js';
import { runStuckWatch, sanitize } from './service.js';

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
    if (env.PRINT_WATCH_REPORT_READY !== 'true') {
      return res.status(503).json({ error: { code: 'watch_report_not_ready' }, claimCollection: 'unavailable', webhookAttempt: 'not_attempted', recipientDelivery: 'unknown', sourceReadAt: null });
    }
    try {
      const deps = overrides?.store ? { env, ...overrides } : { ...(await defaultDeps(env)), ...overrides, env };
      const out = await runStuckWatch(deps);
      const unavailable = out.claimCollection !== 'complete' || out.webhookAttempt === 'unknown' || (!out.webhookConfigured && out.checked > 0);
      return res.status(unavailable ? 503 : 200).json(out);
    } catch (e) {
      console.error('[print-orders-watch]', sanitize(e?.message));
      return res.status(503).json({ error: { code: 'source_or_watcher_unavailable' }, claimCollection: 'unavailable', webhookAttempt: 'unknown', recipientDelivery: 'unknown' });
    }
  };
}
