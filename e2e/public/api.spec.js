import { test, expect } from '@playwright/test';

// The real handlers from api/ are mounted by scripts/e2e-server.mjs. Without a login token every
// one of these must refuse, and must never answer 200 or 500.
const NEEDS_LOGIN = [
  { method: 'GET', url: '/api/privacy/consent' },
  { method: 'POST', url: '/api/privacy/consent', data: { policyVersion: 'x', items: {}, locale: 'he' } },
  { method: 'POST', url: '/api/books/reserve', data: {} },
  { method: 'POST', url: '/api/ai/generate', data: { prompt: 'hello' } },
  { method: 'POST', url: '/api/ai/tts', data: { text: 'hello' } },
];

for (const { method, url, data } of NEEDS_LOGIN) {
  test(`${method} ${url} answers 401 without a login`, async ({ request }) => {
    const res = await request.fetch(url, { method, data });
    expect(res.status()).toBe(401);
  });

  test(`${method} ${url} answers 401 for a garbage token`, async ({ request }) => {
    const res = await request.fetch(url, {
      method,
      data,
      headers: { Authorization: 'Bearer not.a.jwt' },
    });
    expect(res.status()).toBe(401);
  });
}

test('the consent route says no-store, so a consent answer is never cached', async ({ request }) => {
  const res = await request.get('/api/privacy/consent');
  expect(res.headers()['cache-control']).toContain('no-store');
});
