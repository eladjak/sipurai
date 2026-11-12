import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';

const data = vi.hoisted(() => ({ user: { full_name: 'Michal Cohen', xp: 42 }, books: [], loading: false, error: false, offline: false, retry: vi.fn() }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: data.user }) }));
vi.mock('@/screens/shelf/useShelf', () => ({ useShelf: () => data }));
const show = async () => {
  const { default: Tonight } = await import('../Tonight');
  const messages = LANGUAGES.english.translations;
  const t = (key, vars = {}) => { let result = key.split('.').reduce((v, part) => v?.[part], messages) || key; Object.entries(vars).forEach(([k, v]) => { result = result.replace(`{${k}}`, v); }); return result; };
  return render(<I18nContext.Provider value={{ t, language: 'english' }}><MemoryRouter><Tonight /></MemoryRouter></I18nContext.Provider>);
};
afterEach(() => { cleanup(); localStorage.clear(); data.books = []; data.loading = false; data.error = false; data.offline = false; data.retry.mockClear(); });
describe('tonight', () => {
  it('chooses the latest readable book and uses its saved page only when present', async () => {
    data.books = [{ id:'old', title:'Old', status:'complete', created_date:'2025-01-01' }, { id:'new', title:'New', status:'complete', created_date:'2026-01-01' }];
    localStorage.setItem('book_new_page', '3'); await show();
    expect(screen.getByText('Stopped at page 3')).toBeTruthy(); expect(screen.getByRole('link', { name: /continue reading/i }).getAttribute('href')).toBe('/BookView?id=new');
    cleanup(); localStorage.clear(); await show(); expect(screen.getByRole('link', { name: /read again/i })).toBeTruthy();
  });
  it('shows an honest shelf heading and link without claiming favourites or points', async () => {
    data.books = [{ id:'a', title:'A', status:'complete' }, { id:'b', title:'B', status:'complete' }]; await show();
    expect(screen.getByRole('heading', { name: 'More from the shelf' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All books' })).toHaveAttribute('href', '/shelf');
    expect(screen.queryByText(/points earned/i)).toBeNull();
    expect(screen.getByText('Hello, Michal')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /favourite book/i })).toBeNull();
  });
  it('places the new story link inside the night card', async () => {
    data.books = [{ id:'a', title:'A', status:'complete' }]; await show();
    const card = screen.getByRole('region', { name: /tonight.s story/i });
    expect(card.contains(screen.getByRole('link', { name: /or a new story tonight/i }))).toBe(true);
  });
  it('shows a first story action when there are no books', async () => { await show(); expect(screen.getByRole('link', { name: /create.*first story/i }).getAttribute('href')).toBe('/new'); });
  it('does not invent a gift count', async () => { data.books = [{ id:'a', title:'A', status:'complete' }]; await show(); expect(document.body.textContent).not.toMatch(/\d+.*gift/i); });
  it('offers retry on errors and tells the reader when offline', async () => { data.error = true; await show(); fireEvent.click(screen.getByRole('button', { name: /try again/i })); expect(data.retry).toHaveBeenCalledOnce(); cleanup(); data.error = false; data.offline = true; await show(); expect(screen.getByText(/you are offline/i)).toBeTruthy(); });
  it('links to the shelf when books exist but are not yet readable', async () => { data.books = [{ id:'draft', status:'generating' }]; await show(); expect(screen.getByRole('link', { name: /open the shelf/i }).getAttribute('href')).toBe('/shelf'); });

});

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture' }, isLoadingAuth: false, isLoadingPublicSettings: false }), AuthProvider: ({ children }) => children, FallbackAuthProvider: ({ children }) => children }));
vi.mock('@/components/privacy/PrivacyGate', () => ({ default: ({ children }) => children }));
vi.mock('@/lib/PageNotFound', () => ({ default: () => <div data-testid="legacy-page">NotFound</div> }));
vi.mock('@/lib/analytics', () => ({ trackPageView: vi.fn(), identifyUser: vi.fn() }));
vi.mock('@/lib/NavigationTracker', () => ({ default: () => null }));
vi.mock('@/lib/errorTracking', () => ({ initErrorTracking: vi.fn(), captureError: vi.fn() }));
vi.mock('@/utils/storageCleanup', () => ({ cleanupStorage: vi.fn() }));
vi.mock('@/components/ClerkLocaleProvider', () => ({ default: ({ children }) => children }));
vi.mock('@/pages.config', () => {
  const names = ['Blog','BlogPost','BookCreation','PrivacyPolicy','TermsOfService','BookView','BookWizard','CharacterEditor','Characters','Community','CommunityPost','Feedback','Home','LandingPage','Leaderboard','Library','Profile','Settings','StoryIdeas','Contact','Pricing','Accessibility'];
  return { pagesConfig: { Pages: Object.fromEntries(names.map(name => [name, () => <div data-testid="legacy-page">{name}</div>])), mainPage: 'Home', Layout: ({ children }) => children } };
});
it('renders the legacy home when the new shell switch is off', async () => {
  vi.stubEnv('VITE_NEW_SHELL', 'false'); vi.stubEnv('DEV', false);
  try {
    const { default: App } = await import('../../../App.jsx?legacy-tonight-test');
    window.history.pushState({}, '', '/'); render(<App />);
    expect(await screen.findByTestId('legacy-page')).toHaveTextContent('Home');
    expect(screen.queryByText(/what shall we read tonight/i)).toBeNull();
  } finally { cleanup(); vi.unstubAllEnvs(); }
});
