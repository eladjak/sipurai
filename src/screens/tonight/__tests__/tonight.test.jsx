import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';

const data = vi.hoisted(() => ({
  user: { id: 'family-fixture', full_name: 'Michal Cohen', xp: 42 },
  books: [], loading: false, error: false, offline: false, retry: vi.fn(),
  pages: vi.fn(),
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: data.user, isLoading: false }) }));
vi.mock('@/screens/shelf/useShelf', () => ({ useShelf: () => data }));
vi.mock('@/entities/Page', () => ({ Page: { filter: data.pages } }));

const book = (id, status = 'complete', date = '2026-01-01') =>
  ({ id, title: `Story ${id}`, status, created_date: date, created_by: data.user.id });

const show = async () => {
  const { default: Tonight } = await import('../Tonight');
  const messages = LANGUAGES.english.translations;
  const t = (key, vars = {}) => {
    const result = key.split('.').reduce((value, part) => value?.[part], messages) || key;
    return result.replace(/\{(\w+)\}/g, (whole, variable) => vars[variable] ?? whole);
  };
  return render(<I18nContext.Provider value={{ t, language: 'english', isRTL: false }}><MemoryRouter><Tonight /></MemoryRouter></I18nContext.Provider>);
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  data.books = [];
  data.loading = false;
  data.error = false;
  data.offline = false;
  data.retry.mockClear();
  data.pages.mockReset();
});

describe('tonight', () => {
  it('links all three bundled examples to their public reader', async () => {
    await show();
    const samples = within(screen.getByRole('region', { name: 'Sample books' }));
    expect(samples.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/samples/demo-dragons-garden', '/samples/demo-space-adventure', '/samples/demo-brave-fox',
    ]);
  });

  it('labels the restored folio of the newest completed book', async () => {
    data.books = [book('old', 'complete', '2025-01-01'), book('new')];
    data.pages.mockResolvedValue([
      { page_number: 0, text_content: 'Cover' },
      { page_number: 2, text_content: 'First page' },
      { page_number: 4, text_content: 'Second page' },
    ]);
    localStorage.setItem('book_new_page', '2');
    await show();
    const reading = await screen.findByRole('link', { name: 'Continue from page 4' });
    expect(reading).toHaveAttribute('href', '/BookView?id=new');
    expect(screen.getAllByRole('link')[0]).toBe(reading);
    expect(data.pages).toHaveBeenCalledWith({ book_id: 'new' }, 'page_number');

    cleanup();
    localStorage.clear();
    await show();
    expect(screen.getByRole('link', { name: 'Open the book' })).toHaveAttribute('href', '/BookView?id=new');
  });

  it('offers exactly two other completed books by date with a cover fallback', async () => {
    data.books = [
      book('older', 'complete', '2024-01-01'),
      { ...book('second', 'complete', '2025-01-01'), cover_image: '/family-cover.webp' },
      book('new'),
      book('third', 'complete', '2024-10-01'),
      book('later-draft', 'draft', '2026-02-01'),
    ];
    await show();
    const shelf = within(screen.getByRole('region', { name: 'More from the shelf' }));
    const links = shelf.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/BookView?id=second', '/BookView?id=third']);
    expect(screen.getByRole('heading', { name: 'Story new' })).toBeVisible();
    expect(links[0].querySelector('img')).toHaveAttribute('src', '/family-cover.webp');
    fireEvent.error(links[0].querySelector('img'));
    expect(links[0].querySelector('.family-home__cover svg')).toBeInTheDocument();
    expect(links[1].querySelector('.family-home__cover svg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All books' })).toHaveAttribute('href', '/shelf');
    expect(screen.queryByText(/points earned|favourite book/i)).toBeNull();
  });

  it('keeps the only new story link inside the featured book section', async () => {
    data.books = [book('one')];
    await show();
    const story = screen.getByRole('region', { name: 'Story one' });
    const create = within(story).getByRole('link', { name: 'Create a new story' });
    expect(create).toHaveAttribute('href', '/new');
    expect(screen.getAllByRole('link', { name: 'Create a new story' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'More from the shelf' })).toBeNull();
  });

  it('shows a first story action for an empty account', async () => {
    await show();
    expect(screen.getByRole('link', { name: 'Create your first story' })).toHaveAttribute('href', '/new');
    expect(screen.getByText('Hello, Michal Cohen')).toBeVisible();
  });

  it('does not invent a gift count', async () => {
    data.books = [book('one')];
    await show();
    expect(document.body.textContent).not.toMatch(/\d+.*gift/i);
  });

  it('offers retry on server error and distinguishes offline', async () => {
    data.error = true;
    await show();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your books');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(data.retry).toHaveBeenCalledOnce();

    cleanup();
    data.error = false;
    data.offline = true;
    await show();
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline');
  });

  it.each([
    ['generating', /Story owner-book.*In progress/i, '/BookView?id=owner-book'],
    ['failed', /Story owner-book.*Open to recover/i, '/BookView?id=owner-book'],
    ['draft', /Story owner-book.*Open to edit/i, '/BookCreation?id=owner-book'],
  ])('offers an owner route for %s from another device', async (status, label, url) => {
    data.books = [book('owner-book', status)];
    await show();
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', url);
  });

  it('offers a single recovery link when a partial book has no readable page', async () => {
    data.books = [book('owner-book', 'partial')];
    data.pages.mockResolvedValue([{ page_number: 0, text_content: '' }]);
    await show();
    const recover = await screen.findByRole('link', { name: 'Open to recover' });
    expect(recover).toHaveAttribute('href', '/BookView?id=owner-book');
    expect(screen.queryByRole('link', { name: 'Open the book' })).toBeNull();
  });

  it('links to the shelf when books exist but are not yet readable', async () => {
    data.books = [book('generating', 'generating')];
    await show();
    expect(screen.getByRole('link', { name: 'All books' })).toHaveAttribute('href', '/shelf');
  });
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
    expect(screen.queryByRole('region', { name: 'Sample books' })).toBeNull();
  } finally { cleanup(); vi.unstubAllEnvs(); }
});
