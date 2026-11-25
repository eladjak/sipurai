import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { CURRENT_POLICY_VERSION as policyVersion } from '../../api/_lib/policyVersion.js';
import { hasCredentials, SKIP_REASON } from './credentials.js';

// Authentication is real Clerk development. Book, page, saved idea and consent responses are
// synthetic, so the session cannot read or write a production family library.
test.skip(!hasCredentials, SKIP_REASON);
test.setTimeout(75_000);
test.use({ locale: 'he-IL', serviceWorkers: 'block', reducedMotion: 'reduce' });

const fixtureBook = {
  id: 'fixture-moon-book',
  title: 'הירח מעל הגינה',
  status: 'complete',
  language: 'hebrew',
  created_date: '2026-10-31T00:00:00Z',
  cover_image: '/images/spx/hearth.webp',
};

async function installFixtures(page) {
  const data = { books: [], fail: false, owner: null, ideas: [], ideasFail: false, ideaOwners: [] };
  await page.addInitScript(() => {
    // XP is outside these journeys. Keep the shared dev family's metadata steady.
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (String(key).startsWith('first_login_awarded_')) return 'true';
      if (String(key).startsWith('streak_last_active_')) return new Date().toDateString();
      return read.call(this, key);
    };
  });
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': '*',
  };
  await page.route('**/api/privacy/consent', async route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({ json: { hasConsent: true, returning: true, policyVersion } });
  });
  await page.route('https://placeholder.supabase.co/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.endsWith('/books')) {
      const owner = url.searchParams.get('created_by')?.replace(/^eq\./, '');
      if (owner) data.owner = owner;
      if (owner && data.fail) return route.fulfill({ status: 503, headers: cors, json: { message: 'Fixture outage' } });
      const books = data.books.map(book => ({ ...book, created_by: owner || data.owner }));
      return route.fulfill({ headers: cors, json: owner ? books : books[0] || null });
    }
    if (url.pathname.endsWith('/story_ideas')) {
      expect(request.method()).toBe('GET');
      data.ideaOwners.push(url.searchParams.get('created_by'));
      if (data.ideasFail) return route.fulfill({ status: 503, headers: cors, json: { message: 'Fixture outage' } });
      return route.fulfill({ headers: cors, json: data.ideas });
    }
    if (url.pathname.endsWith('/pages')) {
      return route.fulfill({ headers: cors, json: [1, 2, 3, 4].map(page_number => ({
        id: `fixture-page-${page_number}`, book_id: fixtureBook.id, page_number,
        text_content: `הגענו לתחנה ${page_number}.`, image_url: '/images/spx/hearth.webp',
      })) });
    }
    return route.fulfill({ headers: cors, json: [] });
  });
  await page.route('**/api/**', route => route.request().method() === 'GET'
    ? route.fallback()
    : route.fulfill({ status: 403, json: { error: 'Writes disabled in home browser fixtures' } }));
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL });
  return data;
}

async function snapshot(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const links = page.getByRole('link', { name: /יוצרים סיפור ראשון|ממשיכים מעמוד|מתחילים עם הרעיון הזה/ });
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

for (const width of [375, 1280]) {
  test(`family home distinguishes first visit, returning reader, and outage at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const data = await installFixtures(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'איזה סיפור ניצור היום?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'יוצרים סיפור ראשון' })).toHaveAttribute('href', '/BookWizard');
    await snapshot(page, testInfo, `home-empty-${width}`);

    data.books = [fixtureBook];
    await page.evaluate(id => localStorage.setItem(`book_${id}_page`, '2'), fixtureBook.id);
    await page.reload();
    await expect(page.getByRole('heading', { name: fixtureBook.title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ממשיכים מעמוד 3' })).toHaveAttribute('href', `/BookView?id=${fixtureBook.id}`);
    await snapshot(page, testInfo, `home-returning-${width}`);
    await page.getByRole('link', { name: 'ממשיכים מעמוד 3' }).click();
    await expect(page.locator('.reader-folio')).toHaveText('3');
    await expect(page.getByText('הגענו לתחנה 3.', { exact: true })).toBeVisible();
    await page.goto('/');

    data.fail = true;
    await page.reload();
    await expect(page.getByText('לא הצלחנו לטעון את הספרים', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: fixtureBook.title })).toHaveCount(0);
    await snapshot(page, testInfo, `home-error-${width}`);

    data.fail = false;
    await page.getByRole('button', { name: 'לנסות שוב' }).click();
    await expect(page.getByRole('heading', { name: fixtureBook.title })).toBeVisible();
    const ideaTitle = (await page.locator('#home-idea-title').textContent()).trim();
    const ideaBody = (await page.locator('#home-idea-title + p').textContent()).trim();
    await page.getByRole('link', { name: 'מתחילים עם הרעיון הזה' }).click();
    await expect(page).toHaveURL(/\/BookWizard$/);
    await expect(page.locator('textarea').first()).toHaveValue(`${ideaTitle} — ${ideaBody}`);
    await snapshot(page, testInfo, `home-idea-in-wizard-${width}`);
  });
}

for (const width of [375, 1280]) {
  test(`family wizard scopes saved ideas and preserves typed words at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const data = await installFixtures(page);
    await page.goto('/');
    await expect.poll(() => data.owner).toMatch(/^user_/);
    await page.getByRole('link', { name: 'יוצרים סיפור ראשון' }).click();
    await expect(page).toHaveURL(/\/BookWizard$/);

    const customTopic = page.getByRole('radio', { name: 'רעיון משלי', exact: true });
    await customTopic.locator('..').click();
    const idea = page.getByRole('textbox', { name: 'ספר לנו על הרעיון שלך:' });
    const typedIdea = 'שועלה מוצאת מפה בדרך לירח';
    await idea.fill(typedIdea);
    const animals = page.getByRole('radio', { name: 'חיות', exact: true });
    await animals.locator('..').click();
    await expect(animals).toBeChecked();
    await customTopic.locator('..').click();
    await expect(idea).toHaveValue(typedIdea);

    const savedIdeas = page.getByRole('button', { name: 'השתמש ברעיון שמור' });
    data.ideasFail = true;
    await savedIdeas.click();
    const savedError = page.getByRole('alert').filter({ hasText: 'לא הצלחנו לפתוח את הרעיונות ששמרתם.' });
    await expect(savedError).toBeVisible();
    data.ideasFail = false;
    await page.getByRole('button', { name: 'לנסות שוב', exact: true }).click();
    await expect(page.getByText(/עוד אין כאן רעיונות שמורים/)).toBeVisible();
    await expect(savedError).toHaveCount(0);
    expect(data.ideaOwners).toEqual([`eq.${data.owner}`, `eq.${data.owner}`]);

    data.ideas = [{ id: 'fixture-idea', title: 'הדרקון בספרייה', created_by: data.owner }];
    await savedIdeas.click();
    await savedIdeas.click();
    const savedIdea = page.getByRole('button', { name: 'הדרקון בספרייה' });
    await savedIdea.click();
    const replacePrompt = page.getByText('להחליף את הרעיון שלכם ברעיון הזה?', { exact: true });
    await expect(replacePrompt).toBeVisible();
    await page.getByRole('button', { name: 'להשאיר את הרעיון שלי' }).click();
    await expect(replacePrompt).toHaveCount(0);
    await expect(idea).toHaveValue(typedIdea);
    await expect(savedIdea).toBeFocused();
    expect(data.ideaOwners).toEqual(Array(3).fill(`eq.${data.owner}`));
    await snapshot(page, testInfo, `wizard-topic-${width}`);
  });
}
