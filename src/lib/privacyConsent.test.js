import { processors } from './processor-inventory';
import { describe, it, expect, vi } from 'vitest';
import { isGateExempt, waitForAuthHeaders, fetchConsentStatus, acceptConsent, deleteMyAccount, CURRENT_POLICY_VERSION } from './privacyConsent';
import { policyContent, buildPolicyContent, buildGateCopy } from '@/data/privacyPolicyContent';
import { readFileSync } from 'node:fs';

const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const headers = async () => ({ Authorization: 'Bearer t' });

describe('isGateExempt', () => {
  it.each(['/privacy', '/terms', '/accessibility', '/contact', '/pricing', '/welcome', '/blog', '/blog/some-post', '/sign-in', '/sign-up/verify', '/Privacy', '/cancel-subscription'])(
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
  it('accept posts the current version, all three items, and the locale', async () => {
    const fetchImpl = vi.fn(async () => ok({ ok: true }));
    await acceptConsent({ locale: 'he' }, { fetchImpl, getHeaders: headers });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ policyVersion: CURRENT_POLICY_VERSION, items: { guardian_18: true, privacy_children_abroad: true, terms: true }, locale: 'he' });
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
  it('lists the integrated processors in both languages', () => {
    for (const lang of ['he', 'en']) {
      for (const name of processors) {
        expect(policyContent[lang].sections[3].body, `${lang}: ${name}`).toContain(name);
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


describe('policy wording stays TRUE (round 2)', () => {
  const all = (lang, deleteEnabled = false) => buildPolicyContent(deleteEnabled)[lang].sections.map((x) => x.heading + ' ' + x.body).join(' ');

  it('says the photo is used once to draw, is not kept, only the drawing is, and names who receives it', () => {
    const he = all('he');
    const en = all('en');
    expect(he).toContain('לא נשמרת אצלנו');
    expect(he).toContain('נשמר רק הציור');
    expect(en).toContain('we do not keep it');
    expect(en).toContain('Only the drawing is kept');
    for (const t of [he, en]) { expect(t).toContain('Google'); expect(t).toContain('OpenAI'); }
  });

  it('does not make the promises that are false in code', () => {
    for (const lang of ['he', 'en']) {
      const t = all(lang, true).toLowerCase();
      expect(t).not.toMatch(/we keep no information|we share nothing|nothing is public unless/);
      expect(t).not.toMatch(/לא שומרים שום מידע|לא משתפים כלום|שום דבר לא ציבורי/);
      expect(t).not.toContain('coppa');
    }
  });

  it('is honest that drawing files sit in public storage', () => {
    expect(all('he')).toContain('אחסון שאפשר לפתוח בלי סיסמה');
    expect(all('en')).toContain('opened without a password');
  });

  it('deletion wording follows the switch: no button promised while the button is off', () => {
    const off = all('he', false);
    const on = all('he', true);
    expect(off).not.toContain('מחיקת החשבון והנתונים');
    expect(off).toContain('support@sipurai.ai');
    expect(on).toContain('מחיקת החשבון והנתונים');
    expect(buildGateCopy(false).he.rows.find((r) => r.icon === 'trash').text).toContain('במייל');
    expect(buildGateCopy(true).he.rows.find((r) => r.icon === 'trash').text).toContain('בהגדרות');
  });

  it('the gate has a photos row that says the photo is not kept', () => {
    for (const lang of ['he', 'en']) {
      const row = buildGateCopy(false)[lang].rows.find((r) => r.icon === 'camera');
      expect(row).toBeTruthy();
      expect(row.text).toContain('Google');
      expect(row.text).toContain('OpenAI');
    }
    expect(buildGateCopy(false).he.rows.find((r) => r.icon === 'camera').text).toContain('לא נשמרת');
  });

  it('the marketing claims without backing are gone from every locale', () => {
    for (const f of ['he', 'en', 'yi']) {
      const src = readFileSync(`src/components/i18n/locales/${f}.jsx`, 'utf8');
      expect(src, f).not.toMatch(/COPPA/);
      expect(src, f).not.toMatch(/ElevenLabs/);
    }
    expect(readFileSync('src/lib/seo.js', 'utf8')).not.toMatch(/COPPA/);
  });
});
