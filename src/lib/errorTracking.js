/**
 * Error tracking via Sentry.
 *
 * COPPA NOTE: This app may be used by children under 13. We intentionally
 * strip PII (email, name) from Sentry reports to remain COPPA-compliant.
 * Only anonymous user IDs are forwarded.
 *
 * Initialise by calling `initErrorTracking()` once at app startup.
 * Requires VITE_SENTRY_DSN to be set; if absent, errors are only logged
 * to the console in development mode — Sentry is not loaded at all.
 *
 * Sentry is loaded via a dynamic import so it does not add bundle weight
 * to projects that have not configured a DSN.  When VITE_SENTRY_DSN is
 * provided at build time the dynamic import is inlined by Rollup and the
 * SDK is included in the vendor chunk.
 */

/**
 * PII filter for COPPA compliance (Sentry `beforeSend`).
 *
 * Strip email and name from the user context before the event leaves the browser. We keep only the
 * anonymous user ID so we can count affected users without storing personal data.
 *
 * Sentry v8+ delivers `event.breadcrumbs` as an ARRAY. The old code read `event.breadcrumbs.values`,
 * which on an array is Array.prototype.values (a function), so `.map` on it threw inside beforeSend
 * and Sentry dropped the event: errors with breadcrumbs were never reported and never scrubbed.
 * The legacy `{ values: [...] }` shape is still handled.
 */
export function scrubEvent(event) {
  if (event.user) {
    // Keep only the anonymous id: drop email and username/name
    event.user = { id: event.user.id };
  }

  // Allowlist, not blocklist: a children's app must not guess which fields hold a name. A breadcrumb
  // keeps only its kind, time and a few technical fields; free text (console output, messages) and
  // query strings (which can carry ids or names) are dropped.
  const pathOnly = (u) => (typeof u === 'string' ? u.split(/[?#]/)[0] : u);
  const SAFE_DATA = ['method', 'status_code', 'from', 'to', 'url'];
  const scrubCrumb = (crumb) => {
    if (!crumb || typeof crumb !== 'object') return crumb;
    const out = { type: crumb.type, category: crumb.category, level: crumb.level, timestamp: crumb.timestamp };
    if (crumb.category && /^(ui.click|navigation)$/.test(crumb.category) && typeof crumb.message === 'string') {
      out.message = crumb.message; // DOM selector / route, no user text
    }
    if (crumb.data && typeof crumb.data === 'object') {
      const data = {};
      for (const k of SAFE_DATA) if (crumb.data[k] !== undefined) data[k] = k === 'url' || k === 'from' || k === 'to' ? pathOnly(crumb.data[k]) : crumb.data[k];
      out.data = data;
    }
    return out;
  };

  if (event.request && typeof event.request === 'object') {
    event.request = { ...event.request, url: pathOnly(event.request.url) };
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) delete event.request.headers.Referer;
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubCrumb);
  } else if (Array.isArray(event.breadcrumbs?.values)) {
    event.breadcrumbs.values = event.breadcrumbs.values.map(scrubCrumb);
  }

  return event;
}

/** @type {import('@sentry/react') | null} */
let _sentry = null;
let _initPromise = null;

/**
 * Initialise Sentry error tracking.
 * Call once at application startup (e.g. in App.jsx useEffect).
 * Safe to call multiple times — subsequent calls return the in-flight promise
 * (prevents double-init under React StrictMode dev double-mount).
 */
export async function initErrorTracking() {
  if (_sentry !== null) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
      if (import.meta.env.DEV) {
        console.debug('[errorTracking] VITE_SENTRY_DSN not set — running without Sentry');
      }
      _sentry = undefined;
      return;
    }

    // Dynamic import: only bundled/loaded when DSN is set
    const Sentry = await import('@sentry/react');

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,

      // Low sample rate to keep costs down (10 % of transactions)
      tracesSampleRate: 0.1,

      // Only send 10 % of session replays (if replay integration is added later)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 0.5,

      /**
       * beforeSend — PII filter for COPPA compliance.
       *
       * Strip email and name from the user context before the event leaves
       * the browser. We keep only the anonymous user ID so we can count
       * affected users without storing personal data.
       */
      beforeSend: scrubEvent,
    });

    _sentry = Sentry;

    if (import.meta.env.DEV) {
      console.debug('[errorTracking] Sentry initialised (env:', import.meta.env.MODE, ')');
    }
  })();

  return _initPromise;
}

/**
 * Capture an error with optional context.
 * @param {Error} error
 * @param {Record<string, unknown>} context - Extra context (componentStack, etc.)
 */
export function captureError(error, context = {}) {
  if (_sentry) {
    _sentry.captureException(error, { extra: context });
  } else if (import.meta.env.DEV) {
    console.error('[errorTracking]', error, context);
  }
}

/**
 * Associate the current user with future error reports.
 *
 * COPPA: Only the anonymous user ID is forwarded to Sentry.
 * Email and display name are intentionally omitted.
 *
 * @param {{ id?: string, email?: string, name?: string }} user
 */
export function setUser(user) {
  if (!user) return;

  if (_sentry) {
    // COPPA compliance: send only the anonymous ID, never email or name
    _sentry.setUser({ id: user.id });
  } else if (import.meta.env.DEV) {
    console.debug('[errorTracking] setUser (id only):', user.id);
  }
}
