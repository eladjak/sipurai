import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Shelf from '../Shelf';
import { useShelf } from '../useShelf';
vi.mock('../useShelf', () => ({ useShelf: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }), I18nProvider: ({ children }) => children }));
const books = [{ id: '1', title: 'First', child_name: 'A', status: 'complete', cover_image: '/one.jpg' }, { id: '2', title: 'Second', child_name: 'B', status: 'generating' }];
function show(data = books) { useShelf.mockReturnValue({ books: data, loading: false, error: false, offline: false, retry: vi.fn() }); return render(<MemoryRouter><Shelf /></MemoryRouter>); }
describe('shelf', () => {
  it('shows each book', () => { show(); expect(screen.getByText('First')).toBeTruthy(); expect(screen.getByText('Second')).toBeTruthy(); cleanup(); });
  it('filters by hero', () => { show(); fireEvent.click(screen.getByRole('button', { name: 'A' })); expect(screen.queryByText('Second')).toBeNull(); cleanup(); });
  it('shows generating status and no read action', () => { show(); fireEvent.click(screen.getByRole('button', { name: /Second/ })); expect(screen.getAllByText('shelf.generating').length).toBeGreaterThan(0); expect(screen.queryByRole('link', { name: /shelf.read/ })).toBeNull(); cleanup(); });
  it('shows available actions but hides print when disabled', () => { show(); fireEvent.click(screen.getByRole('button', { name: /First/ })); expect(screen.getByRole('link', { name: /shelf.read/ })).toBeTruthy(); expect(screen.queryByRole('link', { name: /shelf.print/ })).toBeNull(); cleanup(); });
});

describe('review regressions', () => {
  it('offers reading for a partial book', () => { show([{ id: '3', title: 'Partial', status: 'partial' }]); fireEvent.click(screen.getByRole('button', { name: /Partial/ })); expect(screen.getByRole('link', { name: /shelf.read/ })).toBeTruthy(); cleanup(); });
  it('uses a neutral label for an unknown status', () => { show([{ id: '4', title: 'Unknown', status: 'future' }]); expect(screen.getByText('shelf.inProgress')).toBeTruthy(); cleanup(); });
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

describe('switch-off App integration', () => {
  it('renders the old library and does not route shelf', async () => {
    vi.stubEnv('VITE_NEW_SHELL', 'false');
    vi.stubEnv('DEV', false);
    try {
      const { default: App } = await import('../../../App.jsx?legacy-shelf-test');
      window.history.pushState({}, '', '/Library');
      const view = render(<App />);
      expect(await screen.findByTestId('legacy-page')).toHaveTextContent('Library');
      view.unmount();
      window.history.pushState({}, '', '/shelf');
      render(<App />);
      expect(await screen.findByTestId('legacy-page')).toHaveTextContent('NotFound');
      expect(screen.queryByText('shelf.title')).toBeNull();
      cleanup();
    } finally { vi.unstubAllEnvs(); }
  });
});
