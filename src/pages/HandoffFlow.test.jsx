vi.mock("@/components/auth/AuthFeedback", () => ({ AuthFeedback: ({ children }) => children }));
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Pricing from './Pricing';
import SignUp from './SignUp';
import SignIn from './SignIn';
const state = vi.hoisted(() => ({ user: null, shell: false, payments: vi.fn() }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: state.user, isAuthenticated: !!state.user }) }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => state.shell }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ isRTL: false, language:'english', t: key => key }) }));
vi.mock('@/lib/creem', () => ({ openCheckout: state.payments }));
vi.mock('@clerk/clerk-react', async () => {
  const React = await import('react');
  const router = await import('react-router-dom');
  const Clerk = ({ forceRedirectUrl, fallbackRedirectUrl }) => { const navigate = router.useNavigate(); const raw = new URLSearchParams(router.useLocation().search).get('redirect_url'); return React.createElement('button', {onClick: () => {state.user = {id:'owner-a'}; navigate(forceRedirectUrl || raw || fallbackRedirectUrl);}}, 'complete authentication'); };
  return { SignUp: Clerk, SignIn: Clerk };
});
vi.mock('framer-motion', async () => { const React = await import('react'); return { motion: new Proxy({}, {get: (_, tag) => ({children, ...props}) => React.createElement(String(tag), Object.fromEntries(Object.entries(props).filter(([key]) => !['initial','animate','whileInView','transition','viewport'].includes(key))), children)}) }; });
afterEach(() => { cleanup(); state.payments.mockClear(); });
function app(initial) { return render(<MemoryRouter initialEntries={[initial]}><Routes><Route path="/pricing" element={<Pricing/>}/><Route path="/sign-up" element={<SignUp/>}/><Route path="/sign-in" element={<SignIn/>}/><Route path="/b/print/:id" element={<p>QR destination</p>}/></Routes></MemoryRouter>); }
describe('full mocked authentication handoff', () => {
  it.each([false,true])('selected plan returns to authenticated review in shell %s without payment', shell => {
    state.shell = shell; state.user = null; app('/pricing');
    fireEvent.click(screen.getByRole('link', {name:'landing.pricing.lite.cta'}));
    fireEvent.click(screen.getByRole('button', {name:'complete authentication'}));
    expect(screen.getByRole('status')).toHaveTextContent('landing.pricing.lite.name');
    expect(state.payments).not.toHaveBeenCalled();
  });
  it.each([false,true])('QR return survives sign-up in shell %s', shell => {
    state.shell = shell; state.user = null; app('/sign-up?redirect_url=%2Fb%2Fprint%2Fabc');
    fireEvent.click(screen.getByRole('button', {name:'complete authentication'}));
    expect(screen.getByText('QR destination')).toBeInTheDocument();
  });
});
