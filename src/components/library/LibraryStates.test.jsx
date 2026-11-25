import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Library from '@/pages/Library';

const fixtures = vi.hoisted(() => ({ user: { id: 'owner-a' }, filter: vi.fn() }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: fixtures.user }) }));
vi.mock('@/entities/Book', () => ({ Book: { filter: fixtures.filter } }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key, isRTL: true }) }));
vi.mock('./BookCard', () => ({ default: ({ book }) => <article>{book.title}</article> }));

const tree = <MemoryRouter><Library /></MemoryRouter>;
beforeEach(() => {
  fixtures.user = { id: 'owner-a' };
  fixtures.filter.mockReset();
});

describe('library artwork states', () => {
  it('shows an illustrated status while loading and preserves the create link when empty', async () => {
    let resolve;
    fixtures.filter.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    render(tree);
    expect(screen.getByRole('status')).toHaveTextContent('shelf.loading');
    expect(screen.queryByText('library.noBooks')).toBeNull();
    await act(async () => { resolve([]); });
    expect(screen.getByRole('heading', { name: 'library.noBooks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'library.createBook' })).toHaveAttribute('href', '/BookWizard');
    expect(document.querySelector('img[src="/images/empty-library.jpg"]')).toBeInTheDocument();
  });

  it('offers a recovery action for a filter miss and a separate retry for a failed load', async () => {
    fixtures.filter.mockRejectedValueOnce(new Error('no fetch'));
    fixtures.filter.mockResolvedValueOnce([{ id: '1', created_by: 'owner-a', title: 'The hidden tree' }]);
    render(tree);
    expect(await screen.findByRole('alert')).toHaveTextContent('shelf.errorTitle');
    fireEvent.click(screen.getByRole('button', { name: 'shelf.retry' }));
    expect(await screen.findByText('The hidden tree')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('library.search'), { target: { value: 'unmatched' } });
    expect(screen.getByRole('heading', { name: 'shelf.noMatchesTitle' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'shelf.clearFilters' }));
    expect(screen.getByText('The hidden tree')).toBeInTheDocument();
  });

  it('discards old owner results when an account changes during library loading', async () => {
    let resolvePrevious;
    fixtures.filter.mockReturnValueOnce(new Promise(done => { resolvePrevious = done; }));
    fixtures.filter.mockResolvedValueOnce([{ id: 'new', created_by: 'owner-b', title: 'New owner story' }]);
    const view = render(tree);
    fixtures.user = { id: 'owner-b' };
    view.rerender(<MemoryRouter><Library /></MemoryRouter>);
    expect(await screen.findByText('New owner story')).toBeInTheDocument();
    await act(async () => resolvePrevious([{ id: 'old', created_by: 'owner-a', title: 'Previous private story' }]));
    expect(screen.queryByText('Previous private story')).toBeNull();
    expect(screen.getByText('New owner story')).toBeInTheDocument();
    expect(fixtures.filter.mock.calls).toEqual([[{ created_by: 'owner-a' }], [{ created_by: 'owner-b' }]]);
  });
});
