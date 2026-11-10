import { test, expect } from '@playwright/test';

test.use({ locale: 'he-IL' });

// These routes are inside the app and need a signed-in parent.
// An anonymous visitor must land on the sign-in page and carry a way back.
const PROTECTED = ['/Library', '/Characters', '/Profile', '/Settings'];

for (const path of PROTECTED) {
  test(`${path} sends an anonymous visitor to sign-in`, async ({ page }) => {
    await page.goto(path);
    await page.waitForURL(/\/sign-in/, { timeout: 20000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('redirect_url')).toContain(path);
    // None of the app's own content may have been shown on the way.
    await expect(page.locator('aside')).toHaveCount(0);
  });
}
