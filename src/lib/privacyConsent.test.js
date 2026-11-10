import { describe, it, expect, vi } from 'vitest';
import { isGateExempt, waitForAuthHeaders, fetchConsentStatus, acceptConsent, deleteMyAccount, CURRENT_POLICY_VERSION } from './privacyConsent';
import { policyContent } from '@/data/privacyPolicyContent';

const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const headers = async () => ({ Authorization: 'Bearer t' });

describe('isGateExempt', () => {
  it.each(['/privacy', '/terms', '/accessibility', '/contact', '/pricing', '/welcome', '/blog', '/blog/some-post', '/sign-in', '/sign-up/verify', '/Privacy'])(
    '%s is open to everyone', (p) => expect(isGateExempt(p)).toBe(true));
  it.each(['/', '/Home', '/Library', '/BookView', '/Settings', '/CreativeStoryStudio', '/orders'])(
    '%s is the app and is gated', (p) => expect(isGateExempt(p)).toBe(false));
});

describe('waitForAuthHeaders', () => {
  it('waits for the token getter instead of failing on the first tick', async () => {
    let n = 0;
    const getHeaders = async () => (++n < 3 ? {} : { Authorization: 'Bearer t' });
    const h = await waitForAuthHeaders({ stepMs: 1, getHeaders });
    expect(h.Authorization).toBe('Bearer t');
    expect(n).toBe(3);
  });
  it('gives up with no header after the timeout', async () => {
    expect(await waitForAuthHeaders({ timeoutMs: 20, stepMs: 5, getHeaders: async () => ({}) })).toEqual({});
  });
});

describe('API calls', () => {
  it('GET status sends the token and nothing that names a user', async () => {
    const fetchImpl = vi.fn(async () => ok({ hasConsent: true }));
    const r = await fetchConsentStatus({ fetchImpl, getHeaders: headers });
    expect(r.hasConsent).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/privacy/consent');
    expect(init.headers.Authorization).toBe('Bearer t');
    expect(init.body).toBeUndefined();
  });
  it('accept posts the current version, both items, and the locale', async () => {
    const fetchImpl = vi.fn(async () => ok({ ok: true }));
    await acceptConsent({ locale: 'he' }, { fetchImpl, getHeaders: headers });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ policyVersion: CURRENT_POLICY_VERSION, items: { guardian_18: true, policy_and_terms: true }, locale: 'he' });
  });
  it('delete posts the confirmation word and no user id', async () => {
    const fetchImpl = vi.fn(async () => ok({ ok: true }));
    await deleteMyAccount({ fetchImpl, getHeaders: headers });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ confirm: 'delete-my-account' });
  });
  it('surfaces the server code and Hebrew message on errors', async () => {
    const fetchImpl = vi.fn(async () => ok({ error: { code: 'paid_subscription', message_he: 'יש מנוי' } }, 409));
    await expect(deleteMyAccount({ fetchImpl, getHeaders: headers })).rejects.toMatchObject({ code: 'paid_subscription', status: 409, message: 'יש מנוי' });
  });
  it('maps a dropped connection to code "network"', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('failed'); });
    await expect(fetchConsentStatus({ fetchImpl, getHeaders: headers })).rejects.toMatchObject({ code: 'network' });
  });
  it('no token -> 401 without calling the network', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchConsentStatus({ fetchImpl, getHeaders: async () => ({}) })).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  }, 10000);
});

describe('policy text', () => {
  it('names every outside processor found in the code, in both languages', () => {
    for (const lang of ['he', 'en']) {
      const text = policyContent[lang].sections.map((s) => s.body).join('\n');
      for (const name of ['Clerk', 'Supabase', 'Vercel', 'Google', 'OpenAI', 'Creem', 'Morning', 'BookPod', 'Sentry', 'Umami', 'Sanity']) {
        expect(text, `${lang} policy should mention ${name}`).toContain(name);
      }
    }
  });
  it('has no em dashes and shows the version', () => {
    for (const lang of ['he', 'en']) {
      const all = JSON.stringify(policyContent[lang]);
      expect(all.includes('—')).toBe(false);
      expect(policyContent[lang].subtitle).toContain(CURRENT_POLICY_VERSION);
    }
  });
});
