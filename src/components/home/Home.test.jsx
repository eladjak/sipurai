import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import Home from '@/pages/Home';
import Tonight from '@/screens/tonight/Tonight';
import demoBooks from '@/data/demoBooks';

const state = vi.hoisted(() => ({ language: 'hebrew', user: null, isLoading: false }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: state.user, isLoading: state.isLoading }) }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn() } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn() } }));
vi.mock('@/components/onboarding/OnboardingWizard', () => ({ default: ({ onCancel }) => <button onClick={onCancel}>close preferences</button> }));
vi.mock('@/components/i18n/i18nProvider', async () => {
  const he = (await import('@/components/i18n/locales/he')).default;
  const en = (await import('@/components/i18n/locales/en')).default;
  const heTonight = (await import('@/components/i18n/locales/he/tonight')).default;
  const enTonight = (await import('@/components/i18n/locales/en/tonight')).default;
  const heLibrary = (await import('@/components/i18n/locales/he/spxLibrary')).default;
  const enLibrary = (await import('@/components/i18n/locales/en/spxLibrary')).default;
  return {
    useI18n: () => {
      const rtl = state.language === 'hebrew';
      const strings = rtl ? { ...he, ...heTonight, ...heLibrary } : { ...en, ...enTonight, ...enLibrary };
      return {
        language: state.language,
        isRTL: rtl,
        t: (key, replacements = {}) => {
          const text = key.split('.').reduce((obj, part) => obj?.[part], strings) || key;
          return text.replace(/\{(\w+)\}/g, (whole, variable) => replacements[variable] ?? whole);
        },
      };
    },
  };
});

const home = (PageComponent = Home) => <MemoryRouter><PageComponent /></MemoryRouter>;
const row = (id, status, date = '2026-11-25') => ({ id, title: `Story ${id}`, status, created_date: date });
const textPage = (page_number, image_url) => ({ page_number, text_content: 'Words on a page', image_url });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Book.filter.mockReset().mockResolvedValue([]);
  Page.filter.mockReset().mockResolvedValue([]);
  state.user = { id: 'owner-a', favorite_topics: ['space'] };
  state.language = 'hebrew';
  state.isLoading = false;
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
});

describe('family home', () => {
  it('keeps samples available during identity loading and offers first creation only after an empty response', async () => {
    state.isLoading = true;
    const { rerender } = render(home());
    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'יוצרים סיפור ראשון' })).toBeNull();
    expect(Book.filter).not.toHaveBeenCalled();
    for (const book of demoBooks) {
      expect(screen.getByRole('link', { name: book.title.he })).toHaveAttribute('href', `/samples/${book.id}`);
      expect(screen.getByRole('link', { name: book.title.he }).querySelector('img')).toHaveAttribute('src', book.cover_image);
    }
    state.isLoading = false;
    rerender(home());
    expect(await screen.findByRole('link', { name: 'יוצרים סיפור ראשון' })).toHaveAttribute('href', '/BookWizard');
  });

  it('validates a zero-based bookmark against readable pages and keeps one reading link', async () => {
    Book.filter.mockResolvedValue([row('ready', 'complete')]);
    Page.filter.mockResolvedValue([textPage(3), textPage(1), textPage(0), { page_number: 2 }]);
    localStorage.setItem('book_ready_page', '2');
    render(home());
    const read = await screen.findByRole('link', { name: 'ממשיכים מעמוד 3' });
    expect(read).toHaveAttribute('href', '/BookView?id=ready');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Story ready');
    expect(screen.getByRole('link', { name: 'כל הספרים' })).toHaveAttribute('href', '/Library');
    expect(screen.getAllByRole('link')[0]).toBe(read);
  });

  it.each([
    { folios: [0, 1, 3], index: 1, label: 'ממשיכים מעמוד 1' },
    { folios: [0, 1, 3], index: 0, label: 'פותחים את הספר' },
    { folios: [0, 1, 2, 3], index: 2, anchor: [3, 2], label: 'ממשיכים מעמוד 3' },
    { folios: [0, 1, 2, 3], index: 1, anchor: [3, 2], label: 'ממשיכים מעמוד 1' },
    { folios: [0, 1, 2], index: 2, anchor: [3, 2], label: 'פותחים את הספר' },
  ])('uses the saved folio with index $index and anchor $anchor', async ({ folios, index, anchor, label }) => {
    Book.filter.mockResolvedValue([row('ready', 'complete')]);
    let finishInspection;
    Page.filter.mockReturnValue(new Promise(resolve => { finishInspection = resolve; }));
    localStorage.setItem('book_ready_page', String(index));
    if (anchor) localStorage.setItem('book_ready_page_anchor', JSON.stringify(anchor));
    render(home());
    await waitFor(() => expect(Page.filter).toHaveBeenCalledTimes(1));
    await act(async () => finishInspection(folios.map(folio => textPage(folio))));
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/BookView?id=ready');
  });

  it('shows generic reading and a fallback when a bookmark is out of range and cover breaks', async () => {
    Book.filter.mockResolvedValue([{ ...row('ready', 'complete'), cover_image: '/broken.webp' }]);
    Page.filter.mockResolvedValue([textPage(0)]);
    localStorage.setItem('book_ready_page', '9');
    const { container } = render(home());
    await screen.findByRole('link', { name: 'פותחים את הספר' });
    await waitFor(() => expect(Page.filter).toHaveBeenCalled());
    const cover = container.querySelector('img[src="/broken.webp"]');
    fireEvent.error(cover);
    expect(container.querySelector('.family-home__art svg')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ממשיכים מעמוד/ })).toBeNull();
  });

  it('routes drafts, running and failed books and shows partial work once', async () => {
    state.language = 'english';
    Book.filter.mockResolvedValue([
      row('draft', 'draft'), row('running', 'generating'), row('failed', 'failed'),
      { ...row('partial', 'partial'), total_pages: 3 },
    ]);
    Page.filter.mockResolvedValue([textPage(1), textPage(2, '/illustration.webp')]);
    render(home(Tonight));
    expect(await screen.findByText('2 of 3 pages are ready to read. You can finish the illustrations inside the book.')).toBeVisible();
    expect(screen.getAllByText('Story partial')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Story draft/ })).toHaveAttribute('href', '/BookCreation?id=draft');
    expect(screen.getByRole('link', { name: /Story running/ })).toHaveAttribute('href', '/BookView?id=running');
    expect(screen.getByRole('link', { name: /Story failed/ })).toHaveAttribute('href', '/BookView?id=failed');
    expect(screen.getByRole('link', { name: 'All books' })).toHaveAttribute('href', '/shelf');
    expect(screen.getByRole('link', { name: 'Create a new story' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('heading', { level: 1 }).closest('.family-home')).toHaveAttribute('dir', 'ltr');
  });

  it('distinguishes a server error from an empty shelf and retries', async () => {
    Book.filter.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([]);
    render(home());
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו לטעון את הספרים');
    expect(screen.queryByRole('link', { name: 'יוצרים סיפור ראשון' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'לנסות שוב' }));
    expect(await screen.findByRole('link', { name: 'יוצרים סיפור ראשון' })).toBeVisible();
  });

  it('recovers automatically on reconnect', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    render(home());
    expect(screen.getByRole('status')).toHaveTextContent('אין חיבור לרשת');
    expect(Book.filter).not.toHaveBeenCalled();
    fireEvent(window, new Event('online'));
    expect(await screen.findByRole('link', { name: 'יוצרים סיפור ראשון' })).toBeVisible();
  });

  it('discards an old owner’s pending books and displays only the new owner’s idea', async () => {
    let finishOld;
    Book.filter.mockImplementation(({ created_by }) => created_by === 'owner-a'
      ? new Promise(resolve => { finishOld = resolve; })
      : Promise.resolve([row('current', 'complete')]));
    const { rerender } = render(home());
    expect(screen.getByText('חללית בעציץ')).toBeVisible();
    state.user = { id: 'owner-b', favorite_topics: ['science'] };
    rerender(home());
    expect(await screen.findByRole('heading', { name: 'Story current' })).toBeVisible();
    await act(async () => finishOld([row('other-account', 'complete')]));
    expect(screen.queryByText('Story other-account')).toBeNull();
    expect(screen.queryByText('חללית בעציץ')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'מתחילים עם הרעיון הזה' }));
    expect(JSON.parse(sessionStorage.getItem('sipurai_pending_idea'))).toMatchObject({
      ownerId: 'owner-b', title: 'טיפה עם סוד',
    });
  });

  it('returns focus to the preferences trigger after close', async () => {
    render(home());
    const trigger = screen.getByRole('button', { name: 'בחירת העדפות לסיפורים' });
    trigger.focus();
    fireEvent.click(trigger);
    const preferences = screen.getByRole('dialog', { name: 'בחירת העדפות לסיפורים' });
    fireEvent.click(await within(preferences).findByRole('button', { name: 'close preferences' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
