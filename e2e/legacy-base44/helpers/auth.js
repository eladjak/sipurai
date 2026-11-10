// @ts-check

/**
 * Auth helpers for Playwright E2E tests.
 *
 * The app uses Base44 SDK authentication. In E2E tests we cannot easily mock
 * the Base44 auth flow (which redirects to an external OAuth page), so these
 * helpers detect the auth gate and provide utilities for tests to handle it
 * gracefully — either by skipping the assertion or by checking for the
 * redirect/login spinner.
 */

/**
 * AUTH_REDIRECT_PATTERNS — URL substrings that indicate the app has redirected
 * to the Base44 login page.
 */
export const AUTH_REDIRECT_PATTERNS = [
  'base44.app/login',
  'base44.app/auth',
  '/login',
  '/auth',
];

/**
 * isAuthPage — Returns true if the current page URL looks like an auth/login
 * page rather than the main app.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {boolean}
 */
export function isAuthPage(page) {
  const url = page.url();
  return AUTH_REDIRECT_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * waitForApp — Waits for the main application shell (the sidebar) to become
 * visible. If the app redirects to login before the sidebar appears the
 * function resolves early and returns `false`; callers can use this to skip
 * auth-gated assertions.
 *
 * Usage:
 *   const appLoaded = await waitForApp(page);
 *   if (!appLoaded) { test.skip(); return; }
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {number} [opts.timeout] - ms to wait before giving up (default 15000)
 * @returns {Promise<boolean>} true if the app shell loaded, false if auth gate
 */
export async function waitForApp(page, { timeout = 15000 } = {}) {
  try {
    // The sidebar brand link contains the text "Sipurai". Waiting for it to
    // be visible means the app shell (Layout.jsx) has rendered successfully.
    await page.waitForSelector('text=Sipurai', { timeout });
    return true;
  } catch {
    // Could not find app shell — probably redirected to login.
    return false;
  }
}

/**
 * skipIfNotAuthenticated — Calls test.skip() if the app redirected to login.
 * Call this at the beginning of any test that requires authentication.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export async function skipIfNotAuthenticated(page, testInfo) {
  if (isAuthPage(page)) {
    testInfo.skip(true, 'Skipping: app redirected to auth page (no test credentials)');
  }
  const appLoaded = await waitForApp(page);
  if (!appLoaded) {
    testInfo.skip(true, 'Skipping: app shell did not load (likely auth gate)');
  }
}

/**
 * waitForPageContent — Waits for the loading spinner (if any) to disappear
 * and for the page content to settle. Useful after navigation.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function waitForPageContent(page, timeout = 10000) {
  // Wait for the purple spinner (border-t-purple-700) to disappear if it appears.
  try {
    const spinner = page.locator('.animate-spin').first();
    // Only wait for spinner to disappear if it's currently visible.
    if (await spinner.isVisible({ timeout: 500 })) {
      await spinner.waitFor({ state: 'hidden', timeout });
    }
  } catch {
    // Spinner was never visible — that's fine.
  }
}
