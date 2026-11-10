import { test, expect } from '@playwright/test';

// Anonymous visitors, Hebrew browser, no account and no secrets needed.
test.use({ locale: 'he-IL' });

const PUBLIC_PAGES = [
  { path: '/', h1: /הסיפור של הילד שלכם/ },
  { path: '/privacy', h1: /מדיניות פרטיות/ },
  { path: '/terms', h1: /תנאי שימוש/ },
  { path: '/accessibility', h1: /הצהרת נגישות/ },
  { path: '/blog', h1: /.+/ },
  { path: '/pricing', h1: /.+/ },
];

test.describe('public pages', () => {
  test('landing page renders in Hebrew, right to left', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'he');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1').first()).toContainText('הסיפור של הילד שלכם');
    await expect(page).toHaveTitle(/סיפוראי/);
  });

  for (const { path, h1 } of PUBLIC_PAGES) {
    test(`${path} opens, has a heading and throws no page error`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1').first()).toContainText(h1);
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(pageErrors).toEqual([]);
      // Anonymous visitors must never be bounced to sign-in from a public page.
      expect(new URL(page.url()).pathname).toBe(path);
    });

    test(`${path} has no horizontal scroll at 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle').catch(() => {});
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }
});
