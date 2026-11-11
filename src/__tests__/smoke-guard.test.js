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
