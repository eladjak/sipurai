import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';

const state = vi.hoisted(() => ({ enabled: false, signedIn: false }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => state.enabled }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: state.signedIn }) }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ isRTL: true, language: 'hebrew', t: key => key }) }));
vi.mock('@clerk/clerk-react', () => ({
  SignIn: props => <div data-clerk="sign-in">{JSON.stringify(props)}</div>,
  SignUp: props => <div data-clerk="sign-up">{JSON.stringify(props)}</div>,
}));

describe('legacy auth output', () => {
  it.each([false, true])('keeps a safe local return through sign-in and sign-up for shell %s', enabled => {
    state.enabled = enabled;
    for (const Component of [SignIn, SignUp]) {
      const markup = renderToStaticMarkup(<MemoryRouter initialEntries={['/?redirect_url=%2FBookWizard']}><Component /></MemoryRouter>);
      expect(markup).toContain('&quot;fallbackRedirectUrl&quot;:&quot;/BookWizard&quot;');
      expect(markup).toContain('redirect_url=%2FBookWizard');
      const unsafe = renderToStaticMarkup(<MemoryRouter initialEntries={['/?redirect_url=%2F%2Fevil.example']}><Component /></MemoryRouter>);
      expect(unsafe).toContain('&quot;fallbackRedirectUrl&quot;:&quot;/&quot;');
    }
    state.enabled = false;
  });

});

describe('new shell', () => {
  it('provides a translated, noindex guest and signed-in recovery page', async () => {
    const { default: NotFound } = await import('./NotFound');
    const { render, screen, cleanup } = await import('@testing-library/react/pure');
    state.signedIn = false;
    const guest = render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'notFound.signIn' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('heading', { name: 'notFound.title' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'notFound.guestHome' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('notFound.title');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    guest.unmount();
    state.signedIn = true;
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'notFound.home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'notFound.shelf' })).toHaveAttribute('href', '/Library');
    cleanup();
  });
});

  it('themes both auth screens only with the switch enabled', () => {
    state.enabled = true;
    for (const Component of [SignIn, SignUp]) {
      const markup = renderToStaticMarkup(<MemoryRouter><Component /></MemoryRouter>);
      expect(markup).toContain('auth.reassurance');
      expect(markup).toContain('sp-shell');
      expect(markup).toContain('formButtonPrimary');
    }
    state.enabled = false;
  });
