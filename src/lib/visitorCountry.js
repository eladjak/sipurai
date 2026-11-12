/**
 * Visitor country, as seen by the server (Vercel geo header), via GET /api/payments/checkout.
 * Fetched once per session and cached in sessionStorage. Returns '' when unknown or on failure,
 * so callers fall back to the language/timezone heuristic in pricing.js.
 */
const KEY = 'sipurai_visitor_country';
let inflight = null;

export function cachedVisitorCountry() {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === null ? null : v;
  } catch {
    return null;
  }
}

export function getVisitorCountry() {
  const cached = cachedVisitorCountry();
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/payments/checkout', { method: 'GET', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => String(d?.country || '').toUpperCase())
      .catch(() => '')
      .then((country) => {
        // Only cache a real answer; an empty one may be a transient failure.
        if (country) {
          try { sessionStorage.setItem(KEY, country); } catch { /* storage unavailable */ }
        }
        inflight = null;
        return country;
      });
  }
  return inflight;
}
