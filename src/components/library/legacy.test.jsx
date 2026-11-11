import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '@/pages/Library';
import Characters from '@/pages/Characters';
import BookCard from './BookCard';

const state = vi.hoisted(() => ({ locale: 'he' }));
vi.mock('@/components/i18n/i18nProvider', async () => {
  const he = (await import('@/components/i18n/locales/he/library')).default;
  const en = (await import('@/components/i18n/locales/en/library')).default;
  return { useI18n: () => ({ isRTL: state.locale === 'he', t: key => key.split('.').reduce((v, k) => v?.[k], state.locale === 'he' ? he : en) || key }) };
});
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/entities/Character', () => ({ Character: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

for (const [locale, words] of [['he', ['תצוגת רשת', 'תצוגת רשימה', 'ניקוי החיפוש', 'ספר ללא שם']], ['en', ['Grid view', 'List view', 'Clear search', 'Untitled Book']]]) {
  describe(locale, () => {
    it('renders localized library controls and untitled book', async () => {
      state.locale = locale;
      render(<MemoryRouter><Library /></MemoryRouter>);
      expect(await screen.findByRole('tab', { name: words[0] })).toBeTruthy();
      expect(screen.getByRole('tab', { name: words[1] })).toBeTruthy();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
      expect(screen.getByRole('button', { name: words[2] })).toBeTruthy();
      cleanup();
      render(<MemoryRouter><BookCard book={{ status: 'draft' }} /></MemoryRouter>);
      expect(screen.getByText(words[3])).toBeTruthy();
      cleanup();
    });
    it('renders localized character view controls', async () => {
      state.locale = locale;
      render(<MemoryRouter><Characters /></MemoryRouter>);
      await waitFor(() => expect(screen.getByRole('button', { name: words[0] })).toBeTruthy());
      expect(screen.getByRole('button', { name: words[1] })).toBeTruthy();
      cleanup();
    });
  });
}
