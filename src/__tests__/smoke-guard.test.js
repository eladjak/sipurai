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
