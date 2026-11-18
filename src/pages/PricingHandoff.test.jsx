import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pricing from './Pricing';
const state = vi.hoisted(() => ({ user: null, shell: false }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => state.shell }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ isRTL: false, t: key => key }) }));
vi.mock('framer-motion', async () => { const React = await import('react'); return { motion: new Proxy({}, {get: (_, tag) => ({children, ...props}) => React.createElement(String(tag), Object.fromEntries(Object.entries(props).filter(([key]) => !['initial','animate','whileInView','transition','viewport'].includes(key))), children)}) }; });
afterEach(cleanup);
describe('pricing handoff', () => {
  it.each([false,true])('guest plan survives sign-up in shell %s', shell => {
    state.shell = shell; state.user = null;
    render(<MemoryRouter><Pricing /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /landing.pricing.lite.cta/ });
    expect(link.getAttribute('href')).toBe('/sign-up?redirect_url=%2Fpricing%3Fplan%3Dlite');
  });
  it.each([false,true])('signed-in review displays chosen plan without checkout in shell %s', shell => {
    state.shell = shell; state.user = { id: 'fixture' };
    render(<MemoryRouter initialEntries={['/pricing?plan=lite']}><Pricing /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('landing.pricing.lite.name');
    expect(screen.getByText('spxLibrary.planReview')).toBeInTheDocument();
    expect(screen.getByRole('link', { name:'spxLibrary.accountSettings' })).toHaveAttribute('href', shell ? '/parents' : '/Settings?tab=billing');
  });
});
