import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
let mockLang = 'hebrew';
vi.mock('@/components/i18n/i18nProvider', () => ({
  useI18n: () => ({ t: (k) => k, isRTL: mockLang === 'hebrew', language: mockLang }),
}));
import PricingSection from './PricingSection';

const renderWithTz = (lang, tz) => {
  mockLang = lang;
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone: tz }) }));
  return render(<MemoryRouter><PricingSection /></MemoryRouter>).container.textContent;
};

describe('PricingSection currency', () => {
  beforeEach(() => vi.restoreAllMocks());

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
});
