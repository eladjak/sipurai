import { test, expect } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { targetFor, missingFor, isolateBrowser } from './guard.js';

const target = targetFor();
const missing = missingFor('parent');
test.use({ viewport: { width: 375, height: 812 }, locale: 'he-IL', serviceWorkers: 'block' });
test.skip(missing.length > 0, `Signed-in smoke unavailable: ${missing.join(', ')}`);
test.beforeAll(async () => { await clerkSetup(); });

async function shot(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test('parent sees library, reads two pages, returns and signs out', async ({ page }, testInfo) => {
  await isolateBrowser(page, target);
  await page.goto(target.baseURL);
  await clerk.signIn({ page, emailAddress: target.local ? process.env.E2E_CLERK_USER_EMAIL : process.env.SMOKE_PARENT_EMAIL });
  await page.goto(`${target.baseURL}/Library`);
  const heading = page.getByRole('heading', { name: /ספרי|ספרייה|library/i }).first();
  await expect(heading).toBeVisible();
  await shot(page, testInfo, 'parent-library');
  if (!target.readOnly) {
    const book = page.locator('a[href*="BookView?id="]').first();
    await expect(book).toBeVisible();
    await book.click();
    const next = page.getByRole('button', { name: /^(הבא|next)$/i }).last();
    await expect(next).toBeEnabled();
    await shot(page, testInfo, 'parent-book');
    const progress = page.getByRole('progressbar', { name: /התקדמות|progress/i });
    await expect(progress).toBeVisible();
    const start = Number(await progress.getAttribute('aria-valuenow'));
    for (const number of [1, 2]) {
      await next.click();
      await expect(progress).toHaveAttribute('aria-valuenow', String(start + number));
      await expect(page.getByRole('button', { name: /^(הקודם|previous)$/i }).last()).toBeEnabled();
      await shot(page, testInfo, `parent-page-${number}`);
    }
    await page.getByRole('button', { name: /חזרה לספרייה|back to library/i }).first().click();
    await expect(heading).toBeVisible();
    await shot(page, testInfo, 'parent-return');
  }
  await clerk.signOut({ page });
  await page.goto(`${target.baseURL}/Library`);
  await expect(page).toHaveURL(/sign-in/i);
  await shot(page, testInfo, 'parent-signed-out');
});
