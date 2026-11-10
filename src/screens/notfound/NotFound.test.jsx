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
  it('sign-in matches the original output', () => {
    expect(renderToStaticMarkup(<MemoryRouter><SignIn /></MemoryRouter>)).toMatchInlineSnapshot(`"<div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-800 px-4" dir="rtl"><a class="flex items-center gap-2 mb-8" href="/"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-8 w-8 text-white"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="text-2xl font-bold text-white">Sipurai</span></a><div data-clerk="sign-in">{&quot;routing&quot;:&quot;path&quot;,&quot;path&quot;:&quot;/sign-in&quot;,&quot;signUpUrl&quot;:&quot;/sign-up&quot;,&quot;fallbackRedirectUrl&quot;:&quot;/&quot;,&quot;appearance&quot;:{&quot;elements&quot;:{&quot;rootBox&quot;:&quot;mx-auto&quot;,&quot;card&quot;:&quot;shadow-2xl rounded-2xl&quot;}}}</div></div>"`);
  });
  it('sign-up matches the original output', () => {
    expect(renderToStaticMarkup(<MemoryRouter><SignUp /></MemoryRouter>)).toMatchInlineSnapshot(`"<div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-800 px-4" dir="rtl"><a class="flex items-center gap-2 mb-8" href="/"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-8 w-8 text-white"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="text-2xl font-bold text-white">Sipurai</span></a><div data-clerk="sign-up">{&quot;routing&quot;:&quot;path&quot;,&quot;path&quot;:&quot;/sign-up&quot;,&quot;signInUrl&quot;:&quot;/sign-in&quot;,&quot;fallbackRedirectUrl&quot;:&quot;/&quot;,&quot;appearance&quot;:{&quot;elements&quot;:{&quot;rootBox&quot;:&quot;mx-auto&quot;,&quot;card&quot;:&quot;shadow-2xl rounded-2xl&quot;}}}</div></div>"`);
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
