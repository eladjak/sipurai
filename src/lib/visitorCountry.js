/**
 * Visitor country, as seen by the server (Vercel geo header), via GET /api/payments/checkout.
 * Asked again on every screen that needs it (only simultaneous requests share one answer), so a
 * visitor who travels or changes network is not stuck with an old answer. Gives up after 4 seconds. Returns '' when unknown or on failure,
 * so callers fall back to the language/timezone heuristic in pricing.js.
 */
const TIMEOUT_MS = 4000;
let inflight = null;

export function getVisitorCountry() {
  if (!inflight) {
    const ctrl = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    inflight = fetch('/api/payments/checkout', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ctrl?.signal,
    })
      .then((r) => /** @type {Promise<{ country?: string }>|{ country?: string }} */ (r.ok ? r.json() : {}))
      .then((d) => String(d?.country || '').toUpperCase())
      .catch(() => '')
      .finally(() => { if (timer) clearTimeout(timer); inflight = null; });
  }
  return inflight;
}
