import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nContext, LANGUAGES } from '../i18n/i18nProvider';
import BookView from '../../pages/BookView';

vi.mock('@/entities/Book', () => ({ Book: { get: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn().mockRejectedValue(new Error('guest')) } }));
vi.mock('@/entities/PublicBook', () => ({
  PublicBook: { get: vi.fn().mockResolvedValue({ id: 'demo', title: 'Demo book', total_pages: 1, status: 'complete' }) },
  PublicPage: { filter: vi.fn().mockResolvedValue([{ page_number: 1, text_content: 'A story', image_url: '/demo.png' }]) },
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ navigateToLogin: vi.fn() }) }));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => ({ speak: vi.fn(), stop: vi.fn(), rate: 1, currentWordIndex: -1 }) }));
vi.mock('@/hooks/useGamification', () => ({ default: () => ({ awardXP: vi.fn() }) }));
vi.mock('@/lib/seo', () => ({ updateMeta: vi.fn(), resetMeta: vi.fn() }));
vi.mock('@/lib/generationLock', () => ({ isRunLive: () => false }));
vi.mock('@/components/checkout/OrderBookButton', () => ({ OrderBookButton: () => null }));
vi.mock('@/components/bookReader/GiftEditionCTA', () => ({ default: () => null }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe.each([
  ['hebrew', 'רוצים ספר כזה עם הילד שלכם? נסו בחינם', 'הגדלה'],
  ['english', 'Want a book like this with your child? Try it free', 'Zoom in'],
])('signed-out book in %s', (language, banner, zoom) => {
  it('renders neutral guest copy and translated zoom controls', async () => {
    const translations = LANGUAGES[language].translations;
    const t = (key, replacements = {}) => {
      const value = key.split('.').reduce((part, name) => part?.[name], translations);
      return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => replacements[name] ?? '') : value;
    };
    const isRTL = language === 'hebrew';
    render(<I18nContext.Provider value={{ t, language, isRTL }}><MemoryRouter initialEntries={['/BookView?id=demo']}><BookView /></MemoryRouter></I18nContext.Provider>);
    await waitFor(() => expect(screen.getByText(banner)).toBeTruthy());
    expect(screen.getByRole('button', { name: zoom })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\bXP\b/);
  });
});
