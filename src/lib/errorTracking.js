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
      beforeSend(event) {
        if (event.user) {
          // Keep only the anonymous id — drop email and username/name
          event.user = { id: event.user.id };
        }

        // Also scrub breadcrumbs that might contain PII in their data
        if (event.breadcrumbs?.values) {
          event.breadcrumbs.values = event.breadcrumbs.values.map((crumb) => {
            if (crumb.data) {
              const { email: _e, name: _n, username: _u, ...safeData } = crumb.data;
              return { ...crumb, data: safeData };
            }
            return crumb;
          });
        }

        return event;
      },
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
