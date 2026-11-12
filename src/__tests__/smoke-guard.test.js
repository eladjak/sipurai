import { describe, expect, it } from 'vitest';
import { targetFor } from '../../e2e/signed-in/guard.js';

describe('signed-in smoke target guard', () => {
  it('refuses production and its subdomains unless explicitly read-only', () => {
    expect(() => targetFor({ SMOKE_BASE_URL: 'https://www.sipurai.ai' })).toThrow(/production/i);
    expect(() => targetFor({ SMOKE_BASE_URL: 'https://sipurai.ai.' })).toThrow(/production/i);
    expect(targetFor({ SMOKE_BASE_URL: 'https://www.sipurai.ai', SMOKE_ALLOW_PRODUCTION_READONLY: '1' }).readOnly).toBe(true);
  });
  it('uses isolated local mode by default and rejects malformed targets', () => {
    expect(targetFor({}).local).toBe(true);
    expect(() => targetFor({ SMOKE_BASE_URL: 'file:///etc/passwd' })).toThrow();
  });
});

it('never echoes credentials when the runner rejects a target', async () => {
  const { spawnSync } = await import('node:child_process');
  const marker = 'secret-marker-DO-NOT-PRINT';
  const result = spawnSync(process.execPath, ['scripts/smoke-signed-in.mjs'], { env: { ...process.env, SMOKE_BASE_URL: 'https://sipurai.ai', CLERK_SECRET_KEY: marker }, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).not.toContain(marker);
  expect(result.stdout).toMatch(/SMOKE FAIL/);
});

it('permits only read requests to the explicitly configured test Supabase host', async () => {
  const { isolateBrowser } = await import('../../e2e/signed-in/guard.js');
  let handler;
  await isolateBrowser({ route: async (_, fn) => { handler = fn; } }, targetFor({ SMOKE_BASE_URL: 'https://test.example', SMOKE_SUPABASE_HOST: 'testproject.supabase.co' }));
  async function action(url, method) {
    let result;
    await handler({ request: () => ({ url: () => url, method: () => method }), continue: () => { result = 'allow'; }, abort: () => { result = 'block'; } });
    return result;
  }
  expect(await action('https://testproject.supabase.co/rest/v1/books', 'GET')).toBe('allow');
  expect(await action('https://testproject.supabase.co/rest/v1/books', 'POST')).toBe('block');
  expect(await action('https://other.supabase.co/rest/v1/books', 'GET')).toBe('block');
  expect(await action('https://testproject.supabase.co/rest/v1/rpc/change_data', 'GET')).toBe('block');
});

it('rejects the production Supabase project and accepts the isolated preview hostname', () => {
  expect(() => targetFor({ SMOKE_BASE_URL: 'https://test.example', SMOKE_SUPABASE_HOST: 'furviizyohryyqubosut.supabase.co' })).toThrow(/production/i);
  expect(targetFor({ SMOKE_BASE_URL: 'https://preview.sipurai.ai', SMOKE_SUPABASE_HOST: 'testproject.supabase.co' }).readOnly).toBe(false);
});

it('uses the existing CI parent credentials for local runs', async () => {
  const { missingFor } = await import('../../e2e/signed-in/guard.js');
  expect(missingFor('parent', { E2E_CLERK_USER_EMAIL: 'parent@example.test', CLERK_SECRET_KEY: 'test' })).toEqual([]);
});

it('serves local synthetic books and blocks local service writes', async () => {
  const { isolateBrowser } = await import('../../e2e/signed-in/guard.js');
  let handler;
  await isolateBrowser({ route: async (_, fn) => { handler = fn; } }, targetFor({}));
  async function run(url, method) {
    let result;
    await handler({ request: () => ({ url: () => url, method: () => method, headers: () => ({}) }), fulfill: (value) => { result = value; }, continue: () => { result = 'allow'; }, abort: () => { result = 'block'; } });
    return result;
  }
  expect((await run('https://placeholder.supabase.co/rest/v1/books', 'GET')).json[0].title).toBe('ספר בדיקה');
  expect((await run('https://placeholder.supabase.co/rest/v1/pages', 'GET')).json).toHaveLength(3);
  expect(await run('https://placeholder.supabase.co/rest/v1/books', 'POST')).toBe('block');
  expect(await run('http://localhost:4173/api/story', 'GET')).toBe('block');
  expect((await run('http://localhost:4173/api/privacy/consent', 'GET')).json.hasConsent).toBe(true);
});

it('allows only the Clerk package on jsDelivr over HTTPS GET', async () => {
  const { isolateBrowser } = await import('../../e2e/signed-in/guard.js');
  let handler;
  await isolateBrowser({ route: async (_, fn) => { handler = fn; } }, targetFor({}));
  async function action(url, method = 'GET') {
    let result;
    await handler({ request: () => ({ url: () => url, method: () => method }), continue: () => { result = 'allow'; }, abort: () => { result = 'block'; } });
    return result;
  }
  expect(await action('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js')).toBe('allow');
  expect(await action('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js', 'POST')).toBe('block');
  expect(await action('https://cdn.jsdelivr.net/npm/other/package.js')).toBe('block');
  expect(await action('http://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js')).toBe('block');
  expect(await action('https://cdn.jsdelivr.net/npm/@clerk/../other/package.js')).toBe('block');
});

it('derives local consent from the shared policy version', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('e2e/signed-in/guard.js', 'utf8');
  expect(source).toMatch(/import\s*\{\s*CURRENT_POLICY_VERSION\s*\}\s*from\s*['"]\.\.\/\.\.\/api\/_lib\/policyVersion\.js['"]/);
  expect(source).toMatch(/policyVersion:\s*CURRENT_POLICY_VERSION/);
});
