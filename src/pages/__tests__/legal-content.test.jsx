import { describe, it, expect } from 'vitest';
import { policyContent, gateCopy, POLICY_VERSION } from '@/data/privacyPolicyContent';

const brands = /BookPod|בוקפוד|Morning|חשבונית ירוקה|Creem|Clerk|Supabase|Vercel|Google|OpenAI|Gemini|Sentry|Umami|Sanity/i;
const text = (value) => JSON.stringify(value);

describe('legal content', () => {
  it('removes brands from policy and gate, with a working control', () => {
    expect(text({ ...policyContent.he, injected: 'BookPod' })).toMatch(brands);
    for (const lang of ['he', 'en']) {
      expect(text(policyContent[lang])).not.toMatch(brands);
      expect(text(gateCopy[lang])).not.toMatch(brands);
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
  it('directs parents to categories and the full list in consent help', () => {
    expect(gateCopy.he.rows.find((row) => row.icon === 'users').help).toContain('סוגי השירותים');
    expect(gateCopy.en.rows.find((row) => row.icon === 'users').help).toContain('categories');
  });
  it('offers the full processor list in both languages', () => {
    expect(text(policyContent.he)).toContain('ונשלח את הרשימה המלאה');
    expect(text(policyContent.en)).toContain('we will send the full list');
  });
  it('keeps the policy version', () => {
    expect(POLICY_VERSION).toBe('2026-11-10');
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

it('renders brand-free policy and consent copy in each supported language', () => {
  for (const language of ['hebrew', 'english', 'yiddish']) {
    const value = { language, isRTL: language !== 'english', t: (key) => key };
    const policy = render(<MemoryRouter><I18nContext.Provider value={value}><PrivacyPolicy /></I18nContext.Provider></MemoryRouter>);
    expect(policy.container.textContent).not.toMatch(brands);
    cleanup();
    const consent = render(<MemoryRouter><ConsentScreen lang={language === 'english' ? 'en' : 'he'} isRTL={language !== 'english'} status="idle" errorText="" onAccept={() => {}} onDecline={() => {}} /></MemoryRouter>);
    expect(consent.container.textContent).not.toMatch(brands);
    cleanup();
  }
});

import { termsContent } from '@/data/termsContent';
it('preserves the complete Hebrew terms from the original main branch', () => {
  let hash = 2166136261;
  for (const character of JSON.stringify(termsContent)) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  expect((hash >>> 0).toString(16)).toBe('ff60a3ab');
});
