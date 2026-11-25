import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nContext, LANGUAGES } from '../i18n/i18nProvider';
import BookView from '../../pages/BookView';
import { PublicBook, PublicPage } from '@/entities/PublicBook';

vi.mock('framer-motion', async importOriginal => ({ ...await importOriginal(), useReducedMotion: () => true }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn().mockRejectedValue(new Error('guest')) } }));
vi.mock('@/entities/PublicBook', () => ({
  PublicBook: { filter: vi.fn().mockResolvedValue([{ id: 'demo', title: 'Demo book', total_pages: 1, status: 'complete' }]) },
  PublicPage: { filter: vi.fn().mockResolvedValue([{ page_number: 1, text_content: 'A story', image_url: '/demo.png' }]) },
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ navigateToLogin: vi.fn() }) }));
vi.mock('@/hooks/useGamification', () => ({ default: () => ({ awardXP: vi.fn() }) }));
vi.mock('@/lib/seo', () => ({ updateMeta: vi.fn(), resetMeta: vi.fn() }));
vi.mock('@/lib/generationLock', () => ({ isRunLive: () => false }));
vi.mock('@/components/checkout/OrderBookButton', () => ({ OrderBookButton: () => null }));
vi.mock('@/components/bookReader/GiftEditionCTA', () => ({ default: () => null }));

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function showReader(language) {
  const translations = LANGUAGES[language].translations;
  const t = (key, replacements = {}) => {
    const value = key.split('.').reduce((part, name) => part?.[name], translations);
    return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, double, single) => replacements[double ?? single] ?? '') : value;
  };
  const isRTL = language === 'hebrew';
  const view = render(<I18nContext.Provider value={{ t, language, isRTL }}><MemoryRouter initialEntries={['/BookView?id=demo']}><BookView /></MemoryRouter></I18nContext.Provider>);
  return { ...view, t };
}

describe.each([
  ['hebrew', 'רוצים ספר כזה עם הילד שלכם? נסו בחינם', 'הגדלה', 'מוזיקת רקע'],
  ['english', 'Want a book like this with your child? Try it free', 'Zoom in', 'Background music'],
])('signed-out book in %s', (language, banner, zoom, musicLabel) => {
  it('renders neutral guest copy and translated zoom controls', async () => {
    localStorage.setItem('sipurai_tts_auto', '1');
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    const { t } = showReader(language);
    await waitFor(() => expect(screen.getByText(banner)).toBeTruthy());
    expect(screen.getByRole('button', { name: zoom })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /voice|narration|קול|הקראה/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /read aloud|play narration|הקראה/i })).toBeNull();
    expect(speak).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();

    const music = screen.getByRole('button', { name: musicLabel });
    const audio = document.querySelector('audio');
    const play = vi.spyOn(audio, 'play').mockResolvedValue();
    const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {});
    const paused = vi.spyOn(audio, 'paused', 'get').mockReturnValue(true);
    expect(music).toHaveTextContent(musicLabel);
    expect(music).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(music);
    expect(play).toHaveBeenCalledOnce();
    expect(audio.volume).toBe(0.25);
    expect(audio.loop).toBe(true);
    paused.mockReturnValue(false);
    fireEvent.playing(audio);
    expect(music).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(music);
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.pause(audio);
    expect(music).toHaveAttribute('aria-pressed', 'false');
    fireEvent.error(audio);
    expect(screen.getByText(t('reader.musicUnavailable'))).toBeVisible();
    expect(music).toHaveAttribute('aria-pressed', 'false');
    expect(document.body.textContent).not.toMatch(/\bXP\b/);
  });
});

const pagesWithGap = [
  { page_number: 0, text_content: 'Cover words' },
  { page_number: 1, text_content: 'Folio one' },
  { page_number: 3, text_content: 'Folio three', image_url: '/folio-three.png' },
];
const insertedPages = [
  ...pagesWithGap.slice(0, 2),
  { page_number: 2, text_content: 'Inserted folio' },
  pagesWithGap[2],
];

it('migrates a legacy bookmark and keeps the folio through page insertion and reopen', async () => {
  PublicPage.filter.mockResolvedValueOnce(pagesWithGap);
  localStorage.setItem('book_demo_page', '2');
  const view = showReader('english');
  await screen.findByText('Folio three');
  const picker = screen.getByRole('combobox');
  expect(Array.from(picker.options, option => option.label)).toEqual(['Cover', 'Page 1', 'Page 3']);
  expect(screen.getByRole('img', { name: 'Page 3' })).toBeVisible();
  expect(document.querySelector('.reader-folio')).toHaveTextContent('3');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Page 3');
  expect(localStorage.getItem('book_demo_page_anchor')).toBe('[3,2]');

  PublicPage.filter.mockRejectedValueOnce(new Error('Offline'));
  fireEvent.online(window);
  await screen.findByText(view.t('bookView.loadError'));
  expect(screen.getByText('Folio three')).toBeVisible();

  PublicPage.filter.mockResolvedValueOnce(insertedPages);
  fireEvent.click(screen.getByRole('button', { name: view.t('common.retry') }));
  await waitFor(() => expect(picker).toHaveValue('3'));
  expect(screen.getByText('Folio three')).toBeVisible();
  expect(localStorage.getItem('book_demo_page')).toBe('3');
  expect(localStorage.getItem('book_demo_page_anchor')).toBe('[3,3]');

  view.unmount();
  PublicPage.filter.mockResolvedValueOnce(insertedPages);
  showReader('english');
  expect(await screen.findByText('Folio three')).toBeVisible();
});

it('restores a logical bookmark against a newly inserted folio at startup', async () => {
  PublicPage.filter.mockResolvedValueOnce(insertedPages);
  localStorage.setItem('book_demo_page', '2');
  localStorage.setItem('book_demo_page_anchor', '[3,2]');
  showReader('english');
  expect(await screen.findByText('Folio three')).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('3');
});

it('honors a later numeric bookmark written by the quiet reader', async () => {
  PublicPage.filter.mockResolvedValueOnce(insertedPages);
  localStorage.setItem('book_demo_page', '1');
  localStorage.setItem('book_demo_page_anchor', '[3,2]');
  showReader('english');
  expect(await screen.findByText('Folio one')).toBeVisible();
  expect(localStorage.getItem('book_demo_page_anchor')).toBe('[1,1]');
});

it.each([
  ['hebrew', 'english', 'ArrowRight', -70, 'rtl', 'ltr'],
  ['english', 'hebrew', 'ArrowLeft', 70, 'ltr', 'rtl'],
])('uses the book direction in a %s interface for a %s book', async (interfaceLanguage, bookLanguage, key, swipe, interfaceDir, bookDir) => {
  PublicBook.filter.mockResolvedValueOnce([{ id: 'demo', title: 'Demo book', status: 'partial', language: bookLanguage }]);
  PublicPage.filter.mockResolvedValueOnce(pagesWithGap);
  const view = showReader(interfaceLanguage);
  await screen.findByText('Cover words');
  expect(view.container.querySelector('.family-reader')).toHaveAttribute('dir', interfaceDir);
  expect(view.container.querySelector('.reader-cover')).toHaveAttribute('dir', bookDir);
  fireEvent.keyDown(window, { key });
  await screen.findByText('Folio one');

  const desk = view.container.querySelector('.reader-desk');
  function gesture(x, y) {
    fireEvent.touchStart(desk, { touches: [{ identifier: 1, clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(desk, { changedTouches: [{ identifier: 1, clientX: 100 + x, clientY: 100 + y }] });
  }
  gesture(swipe, 160);
  expect(screen.getByRole('combobox')).toHaveValue('1');
  gesture(swipe, 5);
  await screen.findByText('Folio three');
  expect(view.container.querySelector('.reader-leaf')).toHaveAttribute('dir', bookDir);
  fireEvent.error(view.container.querySelector('.reader-page-art'));
  expect(screen.getByText(view.t('bookView.noIllustration'))).toBeVisible();
  expect(screen.getByText('Folio three')).toBeVisible();
});

it('gives a guest a retry on metadata failure and opens the story when the connection recovers', async () => {
  PublicBook.filter.mockRejectedValueOnce(new Error('Offline'));
  const { t } = showReader('hebrew');
  await screen.findByText(t('bookView.loadError'));
  expect(screen.queryByText(t('bookView.noBook.title'))).toBeNull();
  expect(screen.getByRole('link', { name: t('pageNotFound.goHome') })).toHaveAttribute('href', '/');
  fireEvent.click(screen.getByRole('button', { name: t('common.retry') }));
  expect(await screen.findByText('A story')).toBeVisible();
  expect(screen.queryByText(t('bookView.loadError'))).toBeNull();
  expect(PublicBook.filter).toHaveBeenCalledTimes(2);
});

it.each(['missing', 'private'])('uses the same public unavailable state for a %s book', async () => {
  PublicBook.filter.mockResolvedValueOnce([]);
  const { t } = showReader('hebrew');
  await screen.findByRole('heading', { name: t('bookView.noBook.title') });
  expect(screen.getByText(t('bookView.noBook.description'))).toBeVisible();
  expect(screen.getByRole('link', { name: t('pageNotFound.goHome') })).toHaveAttribute('href', '/');
  expect(PublicPage.filter).not.toHaveBeenCalled();
});

it('provides the same public way home from an empty public book', async () => {
  PublicPage.filter.mockResolvedValueOnce([]);
  const { t } = showReader('hebrew');
  await screen.findByText(t('bookView.building.stopped'));
  expect(screen.getByRole('link', { name: t('pageNotFound.goHome') })).toHaveAttribute('href', '/');
});
