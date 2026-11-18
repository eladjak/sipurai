import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SampleReader from './SampleReader';
import books from '@/data/demoBooks';
vi.mock('@/components/i18n/i18nProvider', async () => { const locale = (await import('@/components/i18n/locales/he/spxLibrary')).default; return { useI18n: () => ({ language: 'hebrew', isRTL: true, t: key => key.split('.').reduce((value, part) => value?.[part], locale) || key }) }; });
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
  it('only offers narration for a matching voice and speaks on request', () => {
    const speak = vi.fn(); const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'he-IL', localService: true }], addEventListener: vi.fn(), removeEventListener: vi.fn(), speak, cancel } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
    const view = open(`/samples/${books[0].id}?page=1`);
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'הקראה' }));
    expect(speak.mock.calls[0][0].text).toBe(books[0].pages[0].text);
    view.unmount(); delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
  it('moves forward and back with RTL arrow keys', () => {
    const view = open(`/samples/${books[0].id}?page=1`);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(books[0].pages[1].text)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(books[0].pages[0].text)).toBeTruthy();
    view.unmount();
  });
  it('hides narration when the device has no matching voice', () => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'en-US', localService: true }], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn() } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {} });
    const view = open(`/samples/${books[0].id}?page=1`);
    expect(screen.queryByRole('button', { name: 'הקראה' })).toBeNull();
    view.unmount(); delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
  it('opens a linked page and rejects unknown books', () => {
    const view = open(`/samples/${books[0].id}?page=3`);
    expect(screen.getByText(books[0].pages[2].text)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'לעמוד הבא' }));
    expect(screen.getByTestId('url').textContent).toBe('?page=4');
    view.unmount(); open('/samples/not-a-public-book');
    expect(screen.getByText('הספר לדוגמה לא נמצא')).toBeTruthy();
  });
});
