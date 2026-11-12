import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: (k) => k, isRTL: true }) }));
import CancelSubscriptionLink from './CancelSubscriptionLink';
import FooterSection from '@/components/landing/FooterSection';

describe('cancel link', () => {
  it('links to /cancel-subscription', () => {
    render(<MemoryRouter><CancelSubscriptionLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'cancelSubscription.footerLink' }).getAttribute('href')).toBe('/cancel-subscription');
  });
  it('the landing footer (the home page for visitors) carries it', () => {
    render(<MemoryRouter><FooterSection /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'cancelSubscription.footerLink' }).getAttribute('href')).toBe('/cancel-subscription');
  });
});
