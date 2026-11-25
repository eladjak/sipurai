import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SampleReader from './SampleReader';
import books from '@/data/demoBooks';
vi.mock('@/components/i18n/i18nProvider', async () => {
  const locale = (await import('@/components/i18n/locales/he/spxLibrary')).default;
  return { useI18n: () => ({
    language: 'hebrew',
    isRTL: true,
    t: (key, params = {}) => (key.split('.').reduce((value, part) => value?.[part], locale) || key)
      .replace(/\{(\w+)\}/g, (token, name) => params[name] ?? token),
  }) };
});
vi.mock('@/components/brand/Wordmark', () => ({ Wordmark: () => <span>Sipurai</span> }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => false }));
function Location() { const location = useLocation(); return <output data-testid="url">{location.search}</output>; }
function open(path) { return render(<MemoryRouter initialEntries={[path]}><Location /><Routes><Route path="/samples/:id" element={<SampleReader />} /></Routes></MemoryRouter>); }
describe('public sample catalogue', () => {
  it.each(books)('reads all pages of $id and offers creation', book => {
    const view = open(`/samples/${book.id}`);
    fireEvent.click(screen.getByRole('button', { name: 'פותחים את הספר' }));
    for (const page of book.pages) {
      expect(screen.getByText(page.text)).toBeTruthy();
      if (page.pageNumber < book.pages.length) fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    }
    expect(screen.getByRole('link', { name: 'יוצרים סיפור משלכם' }).getAttribute('href')).toBe('/BookWizard');
    view.unmount();
  });
  it('reads and turns pages without touching browser speech even when a matching voice exists', () => {
    const speak = vi.fn(), cancel = vi.fn();
    const getVoices = vi.fn(() => [{ lang: 'he-IL', localService: true }]);
    vi.stubGlobal('speechSynthesis', { getVoices, speak, cancel, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn());
    try {
      const view = open(`/samples/${books[0].id}?page=1`);
      expect(screen.getByText(books[0].pages[0].text)).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
      expect(screen.getByText(books[0].pages[1].text)).toBeTruthy();
      view.unmount();
      expect(getVoices).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('moves forward and back with RTL arrow keys', () => {
    const view = open(`/samples/${books[0].id}?page=1`);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(books[0].pages[1].text)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(books[0].pages[0].text)).toBeTruthy();
    view.unmount();
  });
  it('opens a linked page and rejects unknown books', () => {
    const view = open(`/samples/${books[0].id}?page=3`);
    expect(screen.getByText(books[0].pages[2].text)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    expect(screen.getByTestId('url').textContent).toBe('?page=4');
    view.unmount(); open('/samples/not-a-public-book');
    expect(screen.getByText('הספר לדוגמה לא נמצא')).toBeTruthy();
  });
  it('announces position and keeps focus when the last page replaces the next button', () => {
    const book = books[0];
    const view = open(`/samples/${book.id}?page=${book.pages.length - 1}`);
    const next = screen.getByRole('button', { name: 'לעמוד הבא' });
    next.focus();
    fireEvent.click(next);
    expect(screen.getAllByRole('status').at(-1).textContent).toBe(`עמוד ${book.pages.length} מתוך ${book.pages.length}`);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'יוצרים סיפור משלכם' }));
    view.unmount();
  });
  it('shows illustrated fallback when an image fails', () => {
    const view = open(`/samples/${books[0].id}`);
    fireEvent.error(view.container.querySelector('img'));
    expect(view.container.querySelector('.sample-fallback')).toBeTruthy();
    view.unmount();
  });
  it('tries a name only in the current reading session and restores the original on reset', () => {
    const book = books[0];
    const store = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const view = open(`/samples/${book.id}`);
      const name = screen.getByRole('textbox', { name: 'לנסות שם אחר בסיפור' });
      fireEvent.change(name, { target: { value: 'נועה' } });
      fireEvent.click(screen.getByRole('button', { name: 'פותחים את הספר' }));
      expect(screen.getByText(book.pages[0].text.replaceAll('לילי', 'נועה'))).toBeVisible();
      expect(screen.getByTestId('url')).toHaveTextContent('?page=1');
      expect(store).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByRole('button', { name: 'חזרה לשם המקורי' }));
      expect(screen.getByRole('textbox', { name: 'לנסות שם אחר בסיפור' })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: 'פותחים את הספר' }));
      expect(screen.getByText(book.pages[0].text)).toBeVisible();
      view.unmount();
    } finally {
      store.mockRestore();
    }
  });

});
