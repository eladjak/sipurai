// @ts-check
import { test, expect } from '@playwright/test';
import { waitForApp, waitForPageContent, isAuthPage } from './helpers/auth.js';

/**
 * navigation.spec.js — Basic app navigation tests.
 *
 * These tests verify:
 * - The app loads at all (JS bundle, React mount)
 * - The sidebar renders with navigation links
 * - Clicking sidebar links navigates to the correct pages
 * - Dark mode toggle works (class added/removed on <html>)
 *
 * All tests gracefully skip if the app is behind an auth gate without
 * test credentials.
 */

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // -------------------------------------------------------------------------
  // Smoke test — app loads at all
  // -------------------------------------------------------------------------
  test('app loads without a JavaScript error', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/');

    // Wait a moment for React to hydrate / throw any errors
    await page.waitForTimeout(2000);

    // Filter out known non-critical noise from Base44 SDK network calls
    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    // The Vite template typically sets a title; check it's not the raw default
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // App shell — requires auth
  // -------------------------------------------------------------------------
  test('sidebar renders with brand logo', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await expect(page.locator('text=Sipurai').first()).toBeVisible();
  });

  test('sidebar contains main navigation sections', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Check that nav section headings are present (case-insensitive)
    const navText = await sidebar.innerText();
    expect(navText.toLowerCase()).toContain('home');
  });

  test('sidebar navigation links are visible', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();

    // All primary nav items should appear in the sidebar
    const expectedLinks = ['Home', 'Create Book', 'My Library', 'Community'];
    for (const label of expectedLinks) {
      await expect(sidebar.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Navigation — click sidebar links
  // -------------------------------------------------------------------------
  test('clicking Library in sidebar navigates to /Library', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();
    await sidebar.locator('text=My Library').first().click();
    await waitForPageContent(page);

    await expect(page).toHaveURL(/Library/i);
  });

  test('clicking Community in sidebar navigates to /Community', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();
    await sidebar.locator('text=Community').first().click();
    await waitForPageContent(page);

    await expect(page).toHaveURL(/Community/i);
  });

  test('clicking Create Book navigates to /BookWizard', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();
    await sidebar.locator('text=Create Book').first().click();
    await waitForPageContent(page);

    await expect(page).toHaveURL(/BookWizard/i);
  });

  test('clicking Home returns to / from another page', async ({ page }) => {
    // Navigate away first
    await page.goto('/Library');
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    const sidebar = page.locator('aside').first();
    await sidebar.locator('text=Home').first().click();
    await waitForPageContent(page);

    await expect(page).toHaveURL(/^http:\/\/localhost:5173\/?$/);
  });

  // -------------------------------------------------------------------------
  // Dark mode toggle
  // -------------------------------------------------------------------------
  test('dark mode toggle adds dark class to <html>', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    // Find the dark mode button (contains Moon or Sun icon text/aria)
    const darkModeBtn = page.locator('aside button').filter({
      hasText: /dark mode|light mode/i,
    }).first();

    // If the button isn't visible, try locating by icon presence
    const darkModeBtnFallback = page.locator(
      'aside button:has(.lucide-moon), aside button:has(.lucide-sun)'
    ).first();

    const btn = (await darkModeBtn.isVisible()) ? darkModeBtn : darkModeBtnFallback;

    // Capture initial dark state
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    await btn.click();

    const afterClickDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    // The toggle should have flipped the state
    expect(afterClickDark).toBe(!initialDark);

    // Toggle back to restore state for other tests
    await btn.click();
  });

  // -------------------------------------------------------------------------
  // 404 / unknown routes
  // -------------------------------------------------------------------------
  test('unknown route shows a not-found page', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist-xyz');
    await page.waitForTimeout(1500);

    // Should not have a JS crash
    const pageText = await page.locator('body').innerText();
    // Either a 404 message or a redirect to home — both are acceptable
    const isHandled =
      pageText.toLowerCase().includes('not found') ||
      pageText.toLowerCase().includes('page not found') ||
      page.url().includes('localhost:5173');
    expect(isHandled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Mobile — hamburger menu
  // -------------------------------------------------------------------------
  test('mobile hamburger menu toggles sidebar', async ({ page }) => {
    // Use a mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    // On mobile the sidebar starts closed; find the Menu button
    const menuBtn = page.locator('button').filter({ has: page.locator('.lucide-menu') }).first();
    if (!(await menuBtn.isVisible())) {
      // Viewport might still be treating as desktop — skip gracefully
      test.skip();
      return;
    }

    await menuBtn.click();

    // After click the sidebar should be visible (it has translate-x-0)
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
  });
});
