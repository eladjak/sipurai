import { processors } from '@/lib/processor-inventory';
import { describe, it, expect } from 'vitest';
import { policyContent, gateCopy, POLICY_VERSION } from '@/data/privacyPolicyContent';

const text = (value) => JSON.stringify(value);

describe('legal content', () => {
  it('names each code-integrated processor in the actual policy list in both languages', () => {
    for (const lang of ['he', 'en']) {
      const list = policyContent[lang].sections[3].body;
      for (const name of processors) expect(list, `${lang} processor list: ${name}`).toContain(name);
    }
  });
  it('does not promise an unavailable personalized home sample', () => {
    expect(text(policyContent.he)).not.toContain('בדף הבית, לפני הרשמה:');
    expect(text(policyContent.en)).not.toContain('On the home page, before signing up:');
  });
  it('avoids an unverified primary transfer destination', () => {
    expect(text(policyContent.he)).not.toContain('בעיקר בארצות הברית');
    expect(text(policyContent.en)).not.toContain('mainly in the United States');
  });
  it('points consent help to the named list', () => {
    expect(gateCopy.he.rows.find((row) => row.icon === 'users').help).toContain('רשימה המלאה במדיניות');
    expect(gateCopy.en.rows.find((row) => row.icon === 'users').help).toContain('full list in the policy');
  });
  it('bumps the policy version for material changes', () => {
    expect(POLICY_VERSION).toBe('2026-11-12');
  });
  it('gives the notice the Privacy Protection Law s.11 requires, in both languages', () => {
    const he = text(policyContent.he);
    expect(he).toContain('אין חובה בחוק למסור לנו מידע'); // 11(1) voluntary + consequence
    expect(he).toContain('בעל השליטה במאגר המידע'); // 11(2a) who is responsible
    expect(he).toContain('לעיין במידע'); // 11(4) access
    expect(he).toContain('לבקש לתקן'); // 11(4) correction
    expect(he).toContain('מחוץ לישראל'); // transfer abroad, the basis is consent
    const en = text(policyContent.en);
    for (const s of ['No law requires you', 'database controller', 'leaves Israel', 'Privacy Protection Authority']) expect(en).toContain(s);
  });
  it('does not repeat promises the code does not keep', () => {
    const he = text(policyContent.he);
    expect(he).not.toContain('לשניות'); // provider retention is set by the provider, not seconds
    expect(he).not.toContain('בלי זיהוי אישי'); // analytics carry the account number
    expect(he).not.toContain('כל משתמש רואה רק'); // profile directory is readable by signed-in users
    expect(he).not.toContain('הכל נמחק'); // vendors, backups and payment records stay
    expect(text(gateCopy.he)).not.toContain('הכל נמחק');
  });
  it('asks for three separate approvals, naming the children and the transfer abroad', () => {
    for (const lang of ['he', 'en']) {
      expect(gateCopy[lang].guardian).toBeTruthy();
      expect(gateCopy[lang].termsItem).toBeTruthy();
      expect(gateCopy[lang].agree).toBeUndefined();
      expect(gateCopy[lang].whatChanged.length).toBeGreaterThan(2);
    }
    expect(gateCopy.he.privacyItem).toContain('הילדים');
    expect(gateCopy.he.privacyItem).toContain('מחוץ לישראל');
    expect(gateCopy.en.privacyItem).toContain('outside Israel');
  });
});

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext } from '@/components/i18n/i18nProvider';
import TermsOfService from '@/pages/TermsOfService';

function terms(language) {
  return render(<MemoryRouter><I18nContext.Provider value={{ language, isRTL: language !== 'english', t: (key) => key === 'legal.bindingTerms' ? 'The Hebrew version below is the binding version of these terms.' : key }}><TermsOfService /></I18nContext.Provider></MemoryRouter>);
}

it('shows binding Hebrew terms and a note for English and Yiddish only', () => {
  terms('hebrew');
  const hebrew = document.querySelector('section').textContent;
  expect(screen.queryByText(/binding version/)).toBeNull();
  cleanup();
  for (const language of ['english', 'yiddish']) {
    terms(language);
    expect(screen.getByText('The Hebrew version below is the binding version of these terms.')).not.toBeNull();
    expect(document.querySelector('section').textContent).toBe(hebrew);
    expect(document.querySelector('section').closest('[lang="he"][dir="rtl"]')).not.toBeNull();
    cleanup();
  }
});

import PrivacyPolicy from '@/pages/PrivacyPolicy';
import ConsentScreen from '@/components/privacy/ConsentScreen';

it('renders the named processor list and consent summary in each supported language', () => {
  for (const language of ['hebrew', 'english', 'yiddish']) {
    const value = { language, isRTL: language !== 'english', t: (key) => key };
    const policy = render(<MemoryRouter><I18nContext.Provider value={value}><PrivacyPolicy /></I18nContext.Provider></MemoryRouter>);
    for (const name of processors) expect(policy.container.textContent).toContain(name);
    cleanup();
    const consent = render(<MemoryRouter><ConsentScreen lang={language === 'english' ? 'en' : 'he'} isRTL={language !== 'english'} status="idle" errorText="" onAccept={() => {}} onDecline={() => {}} /></MemoryRouter>);
    expect(consent.container.textContent).toContain('Google');
    expect(consent.container.textContent).toContain('OpenAI');
    cleanup();
  }
});

import { termsContent } from '@/data/termsContent';
it('keeps the terms consistent with the policy and with consumer law', () => {
  const t = JSON.stringify(termsContent);
  expect(t).not.toMatch(/בני 13|בן 13/); // accounts are for adults only, like the consent gate
  expect(t).toContain('18 ומעלה');
  expect(t).toContain('שלושה ימי עסקים'); // Consumer Protection Law s.13D
  expect(t).toContain('14 יום'); // s.14C distance sale
  expect(t).not.toContain('בדואר אלקטרוני לפחות 14 ימים'); // the app sends no email
  expect(t).toContain('OpenAI');
});
