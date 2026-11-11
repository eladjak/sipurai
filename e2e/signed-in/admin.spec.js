import { test, expect } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { targetFor, missingFor, isolateBrowser } from './guard.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = targetFor();
test.use({ viewport: { width: 375, height: 812 }, locale: 'he-IL', serviceWorkers: 'block' });
for (const role of ['admin', 'parent']) {
  test(`${role} sees the appropriate print-order access`, async ({ page }) => {
    const missing = missingFor(role);
    test.skip(target.readOnly || missing.length > 0, target.readOnly ? 'Production is restricted to parent sign-in, look and sign-out' : `Signed-in smoke unavailable: ${missing.join(', ')}`);
    await clerkSetup();
    await isolateBrowser(page, target);
    await page.goto(target.baseURL);
    await clerk.signIn({ page, emailAddress: process.env[role === 'admin' ? 'SMOKE_ADMIN_EMAIL' : 'SMOKE_PARENT_EMAIL'] });
    await page.goto(`${target.baseURL}/admin/print-orders`);
    const forbidden = page.getByTestId('admin-403');
    if (role === 'parent') {
      await expect(forbidden).toBeVisible();
      await expect(page.locator('#status-filter')).toHaveCount(0);
      await expect(page.getByTestId('admin-list')).toHaveCount(0);
    }
    else {
      await expect(page.getByRole('heading', { name: /ניהול הזמנות הדפסה|print orders/i })).toBeVisible();
      await expect(forbidden).toHaveCount(0);
      await expect(page.getByTestId('admin-empty').or(page.getByTestId('admin-list'))).toBeVisible();
    }
    const dir = resolve(process.cwd(), '../shots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: resolve(dir, `${role}-admin-access.png`), fullPage: true });
    await clerk.signOut({ page });
  });
}
