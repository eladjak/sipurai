import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import app from '@/App.jsx?raw';

const data = vi.hoisted(() => ({ books: [], loading: false, error: false, offline: false, retry: vi.fn() }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/screens/shelf/useShelf', () => ({ useShelf: () => data }));
const show = async () => {
  const { default: Tonight } = await import('../Tonight');
  const messages = LANGUAGES.english.translations;
  const t = (key, vars = {}) => { let result = key.split('.').reduce((v, part) => v?.[part], messages) || key; Object.entries(vars).forEach(([k, v]) => { result = result.replace(`{${k}}`, v); }); return result; };
  return render(<I18nContext.Provider value={{ t, language: 'english' }}><MemoryRouter><Tonight /></MemoryRouter></I18nContext.Provider>);
};
afterEach(() => { cleanup(); localStorage.clear(); data.books = []; });
describe('tonight', () => {
  it('chooses the latest readable book and uses its saved page only when present', async () => {
    data.books = [{ id:'old', title:'Old', status:'complete', created_date:'2025-01-01' }, { id:'new', title:'New', status:'complete', created_date:'2026-01-01' }];
    localStorage.setItem('book_new_page', '3'); await show();
    expect(screen.getByRole('link', { name: /continue from page 3/i }).getAttribute('href')).toBe('/BookView?id=new');
    cleanup(); localStorage.clear(); await show(); expect(screen.getByRole('link', { name: /read again/i })).toBeTruthy();
  });
  it('shows a first story action when there are no books', async () => { await show(); expect(screen.getByRole('link', { name: /create.*first story/i }).getAttribute('href')).toBe('/new'); });
  it('does not invent a gift count', async () => { data.books = [{ id:'a', title:'A', status:'complete' }]; await show(); expect(document.body.textContent).not.toMatch(/\d+.*gift/i); });
  it('keeps the old home in the switch-off routes and loads tonight only in new shell', () => { expect(app).toMatch(/user \? shell\(Tonight\) : <LandingPage/); expect(app).toMatch(/<MainPage \/>/); expect(app).toMatch(/VITE_NEW_SHELL === 'true' \? lazy\(\(\) => import\('@\/screens\/tonight\/Tonight'\)\) : null/); });
});
