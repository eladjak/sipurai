/**
 * Shared circuit breaker for partner authentication failures (expired / invalid token).
 * State lives in the database (table print_vendor_state, via the order store), so EVERY serverless instance
 * honours a trip made by any other. Interface used by the vendor client:
 *   get() -> { code, until } | null     set(code, untilMs) -> void
 * An unreadable breaker is the caller's problem to treat as closed (the client refuses to call the partner).
 */
export const BREAKER_KEY = 'auth_breaker';

export function createStoreBreaker(store) {
  return {
    async get() {
      const row = await store.getVendorState(BREAKER_KEY);
      if (!row || !row.until) return null;
      const until = Date.parse(row.until);
      return Number.isFinite(until) ? { code: row.value, until } : null;
    },
    async set(code, untilMs) {
      await store.setVendorState(BREAKER_KEY, code, new Date(untilMs).toISOString());
    },
  };
}

/** Per-process fallback (tests, scripts). Not sufficient in production: see createStoreBreaker. */
export function createLocalBreaker() {
  let state = null;
  return {
    async get() { return state; },
    async set(code, untilMs) { state = { code, until: untilMs }; },
  };
}
