import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { CURRENT_POLICY_VERSION as policyVersion } from '../../api/_lib/policyVersion.js';
import { hasCredentials, SKIP_REASON } from './credentials.js';

test.skip(!hasCredentials, SKIP_REASON);
test.setTimeout(75_000);
test.use({ locale: 'he-IL', serviceWorkers: 'block', reducedMotion: 'reduce' });

const id = 'fixture-sharing-book';
const title = 'הירח מעל הגינה';
const privateStatus = 'הספר פרטי. רק אתם יכולים לפתוח אותו בחשבון שלכם.';
const publicStatus = 'כל מי שמקבל את הקישור יכול לקרוא את הספר ולהעביר אותו הלאה.';

async function setup(page) {
  const state = { owner: null, public: false, publish: 0, revoke: 0, signedIn: false, blocked: [] };
  await page.addInitScript(() => {
    localStorage.setItem('language', 'hebrew');
    localStorage.setItem('parentalControls', JSON.stringify({
      allowCommunitySharing: true,
      requireApprovalBeforePublish: false,
    }));
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (String(key).startsWith('first_login_awarded_')) return 'true';
      if (String(key).startsWith('streak_last_active_')) return new Date().toDateString();
      return read.call(this, key);
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    } });
  });
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': '*' };
    if (url.hostname === 'placeholder.supabase.co') {
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.pathname === '/rest/v1/rpc/sipurai_publish_book' && method === 'POST') {
        expect(req.postDataJSON()).toEqual({ p_book: id, p_expected_public: false, p_listing: null });
        expect(state.public).toBe(false);
        state.publish++; state.public = true;
        return route.fulfill({ headers: cors, json: { is_public: true, listing_created: false } });
      }
      if (method !== 'GET') return route.fulfill({ status: 403, headers: cors });
      if (url.pathname === '/rest/v1/books') {
        const book = { id, title, created_by: state.owner, is_public: state.public, status: 'complete',
          language: 'hebrew', total_pages: 1, cover_image: '/images/spx/hearth.webp' };
        const single = (req.headers().accept || '').includes('application/vnd.pgrst.object+json');
        return route.fulfill({ headers: cors, json: single ? book : [book] });
      }
      return route.fulfill({ headers: cors, json: [] });
    }
    if (url.origin === 'http://localhost:4173' && url.pathname === '/api/privacy/consent' && method === 'GET') {
      return route.fulfill({ json: { hasConsent: true, returning: true, policyVersion } });
    }
    if (url.origin === 'http://localhost:4173' && url.pathname === '/api/books/unshare' && method === 'POST') {
      expect(req.headers().authorization || '').toMatch(/^Bearer /);
      expect(req.postDataJSON()).toEqual({ bookId: id });
      expect(state.public).toBe(true);
      state.revoke++; state.public = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (url.origin === 'http://localhost:4173' && !url.pathname.startsWith('/api/') && method === 'GET') return route.continue();
    // Only Clerk's dedicated development login may contact a remote service. After login,
    // even Clerk writes are blocked to protect the shared test account's profile.
    if ((url.hostname.endsWith('.clerk.accounts.dev') || url.hostname.endsWith('.clerk.dev'))
      && (!state.signedIn || method === 'GET')) return route.continue();
    state.blocked.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL });
  state.owner = await page.evaluate(() => window.Clerk?.user?.id);
  expect(Boolean(state.owner)).toBe(true);
  state.signedIn = true;
  return state;
}

async function snapshot(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true,
    mask: [page.locator('a[href="/Profile" i]'), page.locator('.family-home__greeting').filter({ hasText: /^(שלום|Hello)([\s,]|$)/ })], maskColor: '#ede7db' });
}

async function targetSize(target) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}

for (const width of [375, 1280]) {
  test(`public link requires acknowledgement and can be revoked at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await page.goto(`/BookCreation?id=${id}&tab=share`);
    await expect(page.getByText(privateStatus)).toBeVisible();
    const status = page.getByText(privateStatus);
    await expect(status.locator('xpath=ancestor::div[@dir][1]')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('button', { name: 'העתק קישור שיתוף' })).toHaveCount(0);
    await expect(page.getByLabel('קישור קריאה ציבורי')).toHaveCount(0);
    const create = page.getByRole('button', { name: 'יצירת קישור קריאה ציבורי' });
    await targetSize(create);
    await create.focus();
    await expect(create).toBeFocused();
    await page.keyboard.press('Enter');
    const publish = page.getByRole('button', { name: 'פתיחת קישור ציבורי' });
    await expect(publish).toBeDisabled();
    expect(state.publish).toBe(0);
    await page.getByRole('checkbox', { name: /ברור לי שכל מי שיקבל את הקישור/ }).check();
    await targetSize(publish);
    await publish.click();
    await expect(page.getByText(publicStatus)).toBeVisible();
    expect(state.publish).toBe(1);
    const copy = page.getByRole('button', { name: 'העתק קישור שיתוף' });
    await targetSize(copy);
    await copy.click();
    await expect(page.getByLabel('קישור קריאה ציבורי')).toHaveValue(`http://localhost:4173/BookView?id=${id}`);
    await snapshot(page, testInfo, `sharing-public-${width}`);
    const stop = page.getByRole('button', { name: /הפסקת השיתוף/ });
    await targetSize(stop);
    await stop.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(title);
    expect(state.revoke).toBe(0);
    const confirm = dialog.getByRole('button', { name: 'כן, להפסיק לשתף' });
    await targetSize(confirm);
    await confirm.click();
    await expect(page.getByText(privateStatus)).toBeVisible();
    expect(state.revoke).toBe(1);
    await expect(page.getByRole('button', { name: 'העתק קישור שיתוף' })).toHaveCount(0);
    await expect(page.getByLabel('קישור קריאה ציבורי')).toHaveCount(0);
    await expect(page.locator('[tabindex="-1"]').filter({ hasText: title })).toBeFocused();
    await page.reload();
    await expect(page.getByText(privateStatus)).toBeVisible();
    await expect(page.getByRole('button', { name: 'העתק קישור שיתוף' })).toHaveCount(0);
    await snapshot(page, testInfo, `sharing-private-${width}`);
    expect(state.publish).toBe(1);
    expect(state.revoke).toBe(1);
  });
}
