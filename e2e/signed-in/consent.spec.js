import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { hasCredentials, SKIP_REASON } from './credentials.js';

// A real Clerk sign-in (test account, "emailAddress" strategy from Clerk's docs) in front of the real
// app. Only the consent API is replaced by a small in-test stand-in, because CI has no database:
// the stand-in refuses to answer without a Bearer token, so "the app sent the login token" is
// still checked for real.
test.skip(!hasCredentials, SKIP_REASON);
test.use({ locale: 'he-IL' });

const POLICY = '2026-11-10';

test('first visit asks for consent, accepting is saved, the app opens, the next visit does not ask again', async ({ page }) => {
  let accepted = false;
  const seen = { get: 0, post: 0, postBody: null, withoutToken: 0 };

  await page.route('**/api/privacy/consent', async (route) => {
    const req = route.request();
    if (!(req.headers().authorization || '').startsWith('Bearer ')) {
      seen.withoutToken += 1;
      return route.fulfill({ status: 401, json: { error: { code: 'unauthorized' } } });
    }
    if (req.method() === 'GET') {
      seen.get += 1;
      return route.fulfill({ json: { hasConsent: accepted, policyVersion: POLICY } });
    }
    seen.post += 1;
    seen.postBody = req.postDataJSON();
    accepted = true;
    return route.fulfill({ json: { hasConsent: true, policyVersion: POLICY } });
  });

  // Clerk requires an unprotected page that loads Clerk before signing in.
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL });

  // 1. First visit: only the consent screen.
  await page.goto('/');
  await expect(page.locator('#gate-title')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: /ההחלטה בידיים שלכם/ })).toBeVisible();

  // Pressing accept with empty boxes must not save anything.
  const accept = page.getByRole('main').locator('footer button').first();
  await accept.click();
  await expect(page.locator('#gate-missing')).toContainText(/\S/);
  expect(seen.post).toBe(0);

  // 2. Tick both boxes and accept: saved once, with both items.
  await page.locator('#gate-guardian').click();
  await page.locator('#gate-agree').click();
  await accept.click();
  await expect.poll(() => seen.post).toBe(1);
  expect(seen.postBody.policyVersion).toBe(POLICY);
  expect(seen.postBody.items).toEqual({ guardian_18: true, policy_and_terms: true });

  // 3. The app opens: no consent screen, and a signed-in "/" is the dashboard, not the landing page.
  await expect(page.locator('#gate-title')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: /הסיפור של הילד שלכם/ })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/');

  // 4. Second visit: the server remembers, so there is no question.
  const postsBefore = seen.post;
  await page.reload();
  await expect.poll(() => seen.get, { timeout: 15000 }).toBeGreaterThan(1);
  await expect(page.locator('#gate-title')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /הסיפור של הילד שלכם/ })).toHaveCount(0);
  expect(seen.post).toBe(postsBefore);

  // The app always sent its login token to the consent route.
  expect(seen.withoutToken).toBe(0);
});
