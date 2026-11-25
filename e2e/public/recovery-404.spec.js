import { test, expect } from '@playwright/test';

if (process.env.LOCAL_KEYLESS_TEST === '1') {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    });
  });
}

for (const width of [375, 1280]) {
  test(`guest unknown path has recovery actions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/missing-recovery-page?private=secret');
    await expect(page.getByRole('heading', { name: /הדף הזה לא נמצא במדף|This page is not on the shelf/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /לדף הבית|Home page/ })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /סיפור לדוגמה|Sample story/ })).toHaveAttribute('href', '/samples/demo-dragons-garden');
    await expect(page.locator('body')).not.toContainText('private=secret');
    await expect(page.locator('body')).not.toContainText('missing-recovery-page');
    for (const link of await page.locator('main a').all()) {
      const box = await link.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('#sp-entry')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`recovery-${width}.png`) });
    await page.getByRole('link', { name: /סיפור לדוגמה|Sample story/ }).click();
    await expect(page).toHaveURL(/\/samples\/demo-dragons-garden/);
  });
}

test('only real routes require sign-in; disabled features remain unavailable', async ({ page }) => {
  for (const path of ['/BookCreation', '/bOoKcReAtIoN/', '/%42ookCreation']) {
    await page.goto(path);
    await page.waitForURL(process.env.LOCAL_KEYLESS_TEST === '1' && process.env.VITE_NEW_SHELL !== 'true' ? /\/$/ : /\/sign-in/, { timeout: 20000 });
  }
  for (const path of ['/book/id/order', '/orders', '/admin/print-orders', '/__checkout-states', '/__privacy-gate', '/__ui', '/blog/too/many']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: /הדף הזה לא נמצא במדף|This page is not on the shelf/ })).toBeVisible();
  }
});
