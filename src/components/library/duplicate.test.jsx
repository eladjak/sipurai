import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '@/pages/Library';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { supabase } from '@/lib/supabaseClient';

const state = vi.hoisted(() => ({ owner: 'family-a' }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key, isRTL: true }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: state.owner } }) }));
vi.mock('@/components/bookControls/BookControls', () => ({ default: () => null }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn(), create: vi.fn() } }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

const original = { id: 'original', created_by: 'family-a', title: 'Original', is_public: true, printEdition: { revision: 1 }, status: 'complete' };
const copy = { id: 'copy', created_by: 'family-a', title: 'Original (library.copy)', status: 'draft', is_public: false, total_pages: 2 };
const pages = [
  { id: 'second', page_number: 4, text_content: 'Second page' },
  { id: 'first', page_number: 1, text_content: 'First page' },
  { id: 'skeleton', page_number: 2, text_content: '' },
];
const response = { data: [{ copied_count: 2, inserted_count: 2 }], error: null };
const rpcArgs = ['sipurai_finalize_library_copy', {
  p_source: 'original',
  p_target: 'copy',
  p_source_page_ids: ['first', 'second'],
}];

const view = () => <MemoryRouter><Library /></MemoryRouter>;
async function duplicate() {
  fireEvent.click(await screen.findByRole('button', { name: 'bookCard.duplicate' }));
}
const resume = () => screen.findByRole('button', { name: 'libraryLegacy.resumeCopy' });

beforeEach(() => {
  vi.resetAllMocks();
  state.owner = 'family-a';
  Book.filter.mockImplementation(async ({ created_by }) => created_by === 'family-a' ? [original] : []);
  Book.create.mockResolvedValue(copy);
  Page.filter.mockResolvedValue(pages);
  supabase.rpc.mockResolvedValue(response);
});
afterEach(() => {
  expect(Page.create).not.toHaveBeenCalled();
  expect(Book.update).not.toHaveBeenCalled();
  cleanup();
});

describe('legacy library duplicate RPC', () => {
  it('retains A’s interrupted target through a copy of B and retries A without creating another draft', async () => {
    const other = { ...original, id: 'other', title: 'Other' };
    Book.filter.mockResolvedValue([original, other]);
    Book.create.mockResolvedValueOnce(copy).mockResolvedValueOnce({ ...copy, id: 'other-copy', title: 'Other copy' });
    supabase.rpc.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(response);
    render(view());
    let buttons = await screen.findAllByRole('button', { name: 'bookCard.duplicate' });
    fireEvent.click(buttons[0]);
    await resume();
    buttons = screen.getAllByRole('button', { name: 'bookCard.duplicate' });
    fireEvent.click(buttons[1]);
    await screen.findByText('libraryLegacy.complete');
    buttons = screen.getAllByRole('button', { name: 'bookCard.duplicate' });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(3));
    expect(supabase.rpc.mock.calls[2]).toEqual(rpcArgs);
    expect(Book.create).toHaveBeenCalledTimes(2);
  });
  it('retries a source read failure before making any write', async () => {
    Page.filter.mockRejectedValueOnce(new Error('read failed'));
    render(view());
    await duplicate();
    const retry = await screen.findByRole('button', { name: 'shelf.retry' });
    expect(Book.create).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc).toHaveBeenCalledWith(...rpcArgs);
  });

  it('keeps a private draft when the RPC is unavailable and retries the exact copy and page IDs', async () => {
    supabase.rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Function not found' } });
    render(view());
    await duplicate();
    const button = await resume();
    expect(Book.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', is_public: false, created_by: 'family-a' }));
    expect(Book.create.mock.calls[0][0]).not.toHaveProperty('printEdition');
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
    fireEvent.click(button);
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs, rpcArgs]);
    expect(Book.create).toHaveBeenCalledTimes(1);
  });

  it('shows conflict and does not report completion for a target made public', async () => {
    supabase.rpc.mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({ error: { message: 'library_copy_conflict' } });
    render(view());
    await duplicate();
    fireEvent.click(await resume());
    await screen.findByText('libraryLegacy.resumeConflict');
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
    expect(screen.queryByRole('button', { name: 'libraryLegacy.resumeCopy' })).toBeNull();
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs, rpcArgs]);
  });

  it('waits for the RPC result and ignores repeated activation', async () => {
    let finish;
    supabase.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(view());
    await duplicate();
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'libraryLegacy.copying' }));
    expect(Book.create).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
    await act(async () => finish(response));
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs]);
  });

  it('accepts an idempotent zero-insert result after a lost response', async () => {
    supabase.rpc.mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ data: [{ copied_count: 2, inserted_count: 0 }] });
    render(view());
    await duplicate();
    fireEvent.click(await resume());
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs, rpcArgs]);
    expect(Book.create).toHaveBeenCalledTimes(1);
  });

  it('keeps retry visible if the response does not confirm every intended page', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: [{ copied_count: 1, inserted_count: 1 }] });
    render(view());
    await duplicate();
    expect(await resume()).toBeInTheDocument();
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
  });

  it('leaves an empty source as a private draft without finalizing', async () => {
    Page.filter.mockResolvedValueOnce([{ page_number: 0, text_content: ' ' }]);
    render(view());
    await duplicate();
    await screen.findByText('libraryLegacy.emptyDraft');
    expect(Book.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', total_pages: 0 }));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('does not invoke the RPC after switching families while creating the private draft', async () => {
    let finish;
    Book.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(view());
    await duplicate();
    await waitFor(() => expect(Book.create).toHaveBeenCalledTimes(1));
    state.owner = 'family-b';
    rerender(view());
    expect(screen.queryByText('Original')).toBeNull();
    await act(async () => finish(copy));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('retains a late-created target across A → B → A and blocks a second pending create', async () => {
    let finish;
    Book.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(view());
    await duplicate();
    await waitFor(() => expect(Book.create).toHaveBeenCalledTimes(1));
    state.owner = 'family-b';
    rerender(view());
    state.owner = 'family-a';
    rerender(view());
    await duplicate();
    expect(Book.create).toHaveBeenCalledTimes(1);
    await act(async () => finish(copy));
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(Book.create).toHaveBeenCalledTimes(1);
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs]);
  });

  it('clears a terminal conflict only and creates a new draft on the next explicit click', async () => {
    Book.create.mockResolvedValueOnce(copy).mockResolvedValueOnce({ ...copy, id: 'fresh-copy' });
    supabase.rpc.mockRejectedValueOnce(new Error('lost'))
      .mockResolvedValueOnce({ error: { message: 'library_copy_conflict' } })
      .mockResolvedValueOnce(response);
    render(view());
    await duplicate();
    fireEvent.click(await resume());
    await screen.findByText('libraryLegacy.resumeConflict');
    expect(Book.create).toHaveBeenCalledTimes(1);
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs, rpcArgs]);
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(Book.create).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[2][1].p_target).toBe('fresh-copy');
  });

  it('forgets a terminal conflict returned while a different owner is active', async () => {
    let finish;
    Book.create.mockResolvedValueOnce(copy).mockResolvedValueOnce({ ...copy, id: 'fresh-copy' });
    supabase.rpc.mockRejectedValueOnce(new Error('lost'))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(view());
    await duplicate();
    fireEvent.click(await resume());
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(2));
    state.owner = 'family-b';
    rerender(view());
    await act(async () => finish({ error: { message: 'library_copy_conflict' } }));
    expect(screen.queryByText('libraryLegacy.resumeConflict')).toBeNull();
    expect(Book.create).toHaveBeenCalledTimes(1);
    state.owner = 'family-a';
    rerender(view());
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(Book.create).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[2][1].p_target).toBe('fresh-copy');
  });

  it('allows B to copy independently while A creation is pending', async () => {
    let finish;
    const b = { ...original, created_by: 'family-b', title: 'B book' };
    Book.filter.mockImplementation(async ({ created_by }) => created_by === 'family-a' ? [original] : [b]);
    Book.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ ...copy, id: 'b-copy', created_by: 'family-b' });
    const { rerender } = render(view());
    await duplicate();
    await waitFor(() => expect(Book.create).toHaveBeenCalledTimes(1));
    state.owner = 'family-b';
    rerender(view());
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(Book.create.mock.calls[1][0].created_by).toBe('family-b');
    expect(supabase.rpc.mock.calls[0][1].p_target).toBe('b-copy');
    await act(async () => finish(copy));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    state.owner = 'family-a';
    rerender(view());
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc.mock.calls[1]).toEqual(rpcArgs);
    expect(Book.create).toHaveBeenCalledTimes(2);
  });

  it('retains the plan when an already sent RPC resolves after an account switch', async () => {
    let finish;
    supabase.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ data: [{ copied_count: 2, inserted_count: 0 }], error: null });
    const { rerender } = render(view());
    await duplicate();
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    state.owner = 'family-b';
    rerender(view());
    await act(async () => finish(response));
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
    state.owner = 'family-a';
    rerender(view());
    await duplicate();
    await screen.findByText('libraryLegacy.complete');
    expect(supabase.rpc.mock.calls).toEqual([rpcArgs, rpcArgs]);
    expect(Book.create).toHaveBeenCalledTimes(1);
  });

});
