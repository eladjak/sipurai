// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: k => k, language: 'english' }), I18nProvider: ({children}) => children }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({user:{id:'fixture'},isLoadingAuth:false,isLoadingPublicSettings:false}), AuthProvider: ({children}) => children, FallbackAuthProvider: ({children}) => children }));
vi.mock('@/components/ClerkLocaleProvider', () => ({default: ({children}) => children}));
vi.mock('@/components/privacy/PrivacyGate', () => ({default: ({children}) => children}));
vi.mock('@/lib/NavigationTracker', () => ({default: () => null}));
vi.mock('@/lib/errorTracking', () => ({initErrorTracking: vi.fn(), captureError: vi.fn()}));
vi.mock('@/utils/storageCleanup', () => ({cleanupStorage: vi.fn()}));
vi.mock('@/lib/analytics', () => ({trackPageView: vi.fn(), identifyUser: vi.fn()}));
vi.mock('@/lib/PageNotFound', () => ({default: () => <div>Legacy missing</div>}));
vi.mock('@/pages.config', () => ({pagesConfig: {Pages: {Home: () => <div>Home</div>, Settings: () => <div>Old settings</div>, LandingPage: () => <div>Landing</div>, Blog: () => null, BlogPost: () => null, PrivacyPolicy: () => null, TermsOfService: () => null, Accessibility: () => null}, mainPage:'Home', Layout: ({children}) => children}}));
it('retains legacy settings and missing short routes when switch is off', async () => {
 vi.stubEnv('VITE_NEW_SHELL', 'false'); vi.stubEnv('DEV', false);
 try { const {default: App} = await import('@/App.jsx?parents-switch-off');
  window.history.pushState({}, '', '/Settings'); const view = render(<App/>); expect(await screen.findByText('Old settings')).toBeTruthy(); view.unmount();
  for (const path of ['/parents','/help']) { window.history.pushState({}, '', path); const next = render(<App/>); expect(await screen.findByText('Legacy missing')).toBeTruthy(); next.unmount(); }
 } finally { vi.unstubAllEnvs(); }
});
