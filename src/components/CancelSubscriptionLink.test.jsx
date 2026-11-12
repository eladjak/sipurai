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

  it('the landing footer (the home page for visitors) carries it, with the cancellation routes next to it', () => {
    const { container } = render(<MemoryRouter><FooterSection /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: 'cancelSubscription.footerLink' });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.getAttribute('href')).toBe('/cancel-subscription');
    // Consumer Protection Law s.14T(e)(2): routes stated next to the dedicated link; s.14C: who the seller is
    expect(container.textContent).toContain('cancelSubscription.footerRoutes');
    expect(container.textContent).toContain('cancelSubscription.footerPostal');
    expect(container.textContent).toContain('support@sipurai.ai');
    expect(container.textContent).toContain('cancelSubscription.footerNotice');
    expect(container.textContent).toContain('cancelSubscription.footerOperator');
  });
});
