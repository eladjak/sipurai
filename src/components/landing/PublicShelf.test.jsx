import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShowcaseSection from './ShowcaseSection';
import books from '@/data/demoBooks';
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ language: 'hebrew', isRTL: true, t: key => key }) }));
describe('public sample shelf', () => { it('links each complete sample by ID', () => {
  render(<MemoryRouter><ShowcaseSection /></MemoryRouter>);
  for (const book of books) expect(screen.getByRole('link', {name: new RegExp(book.title.he)})).toHaveAttribute('href', `/samples/${book.id}`);
}); });
