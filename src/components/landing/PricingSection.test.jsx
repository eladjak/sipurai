import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
let mockLang = 'hebrew';
vi.mock('@/components/i18n/i18nProvider', () => ({
  useI18n: () => ({ t: (k) => k, isRTL: mockLang === 'hebrew', language: mockLang }),
}));
let mockCountry = '';
vi.mock('@/hooks/useVisitorCountry', () => ({ default: () => mockCountry }));
import PricingSection from './PricingSection';

let lastContainer;
const renderWithTz = (lang, tz) => {
  mockLang = lang;
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone: tz }) }));
  lastContainer = render(<MemoryRouter><PricingSection /></MemoryRouter>).container;
  return lastContainer.textContent;
};
const hrefs = () => [...lastContainer.querySelectorAll('a')].map((a) => a.getAttribute('href'));

describe('PricingSection currency', () => {
  beforeEach(() => vi.restoreAllMocks());

  beforeEach(() => { mockCountry = ''; });

  it('Hebrew visitor sees shekels and no dollar sign', () => {
    const text = renderWithTz('hebrew', 'Asia/Jerusalem');
    expect(text).toContain('14.90 ₪');
    expect(text).toContain('29 ₪');
    expect(text).toContain('39 ₪');
    expect(text).not.toContain('$');
    expect(text).toContain('landing.pricing.taxNoteIls');
  });

  it('English visitor in London sees dollars and no shekel sign', () => {
    const text = renderWithTz('english', 'Europe/London');
    expect(text).toContain('$3.90');
    expect(text).toContain('$7.90');
    expect(text).toContain('$9.90');
    expect(text).not.toContain('₪');
    expect(text).toContain('landing.pricing.taxNoteUsd');
  });

  it('ILS mode: no card leads into a paid flow, CTA says start free', () => {
    const text = renderWithTz('hebrew', 'Asia/Jerusalem');
    expect(hrefs().every((h) => h === '/sign-up?plan=free')).toBe(true);
    expect(text).toContain('landing.pricing.ilsFreeCta');
    expect(text).toContain('landing.pricing.ilsSoon');
  });

  it('USD mode: paid cards still link to paid sign-up', () => {
    renderWithTz('english', 'Europe/London');
    expect(hrefs()).toEqual(expect.arrayContaining(['/sign-up?plan=lite', '/sign-up?plan=premium', '/sign-up?plan=family']));
  });

  it('Hebrew UI but the server says GB: dollars, paid links stay paid', () => {
    mockCountry = 'GB';
    const text = renderWithTz('hebrew', 'Europe/London');
    expect(text).toContain('$3.90');
    expect(text).not.toContain('₪');
    expect(hrefs()).toContain('/sign-up?plan=lite');
  });

  it('English UI in London but the server says IL: shekels', () => {
    mockCountry = 'IL';
    const text = renderWithTz('english', 'Europe/London');
    expect(text).toContain('14.90 ₪');
    expect(text).not.toContain('$');
  });
});
