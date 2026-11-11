import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Shelf from '../Shelf';
import { useShelf } from '../useShelf';
vi.mock('../useShelf', () => ({ useShelf: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }) }));
const books = [{ id: '1', title: 'First', child_name: 'A', status: 'complete', cover_image: '/one.jpg' }, { id: '2', title: 'Second', child_name: 'B', status: 'generating' }];
function show(data = books) { useShelf.mockReturnValue({ books: data, loading: false, error: false, offline: false, retry: vi.fn() }); return render(<MemoryRouter><Shelf /></MemoryRouter>); }
describe('shelf', () => {
  it('shows each book', () => { show(); expect(screen.getByText('First')).toBeTruthy(); expect(screen.getByText('Second')).toBeTruthy(); cleanup(); });
  it('filters by hero', () => { show(); fireEvent.click(screen.getByRole('button', { name: 'A' })); expect(screen.queryByText('Second')).toBeNull(); cleanup(); });
  it('shows generating status and no read action', () => { show(); fireEvent.click(screen.getByRole('button', { name: /Second/ })); expect(screen.getAllByText('shelf.generating').length).toBeGreaterThan(0); expect(screen.queryByRole('link', { name: /shelf.read/ })).toBeNull(); cleanup(); });
  it('shows available actions but hides print when disabled', () => { show(); fireEvent.click(screen.getByRole('button', { name: /First/ })); expect(screen.getByRole('link', { name: /shelf.read/ })).toBeTruthy(); expect(screen.queryByRole('link', { name: /shelf.print/ })).toBeNull(); cleanup(); });
});
