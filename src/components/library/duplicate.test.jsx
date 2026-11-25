import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Library from '@/pages/Library';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';

const state = vi.hoisted(() => ({ owner: 'family-a', toast: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key, isRTL: true }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: state.owner } }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/components/bookControls/BookControls', () => ({ default: () => null }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn(), create: vi.fn() } }));

const original = { id: 'original', created_by: 'family-a', title: 'Original', is_public: true, printEdition: { revision: 1 }, status: 'complete' };
const copy = { id: 'copy', created_by: 'family-a', title: 'Original (library.copy)', status: 'draft' };
const pages = [
  { page_number: 4, book_id: original.id, text_content: 'Second page' },
  { page_number: 1, book_id: original.id, text_content: 'First page', generation_job: 'original-job' },
  { page_number: 2, book_id: original.id, text_content: '' },
];

const view = () => <MemoryRouter><Library /></MemoryRouter>;
async function duplicate() {
  fireEvent.click(await screen.findByRole('button', { name: 'bookCard.duplicate' }));
}

beforeEach(() => {
  vi.resetAllMocks();
  state.owner = 'family-a';
  Book.filter.mockImplementation(async ({ created_by }) => created_by === 'family-a' ? [original] : []);
  Book.create.mockResolvedValue(copy);
  Book.update.mockResolvedValue({ ...copy, status: 'complete' });
  Page.filter.mockResolvedValue(pages);
  Page.create.mockResolvedValue({});
});
afterEach(cleanup);

describe('legacy library duplicate', () => {
  it('offers a safe retry after a read failure without creating a copy', async () => {
    Page.filter.mockRejectedValueOnce(new Error('read failed'));
    render(view());
    await duplicate();
    const retry = await screen.findByRole('button', { name: 'shelf.retry' });
    expect(Book.create).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(Book.update).toHaveBeenCalledTimes(1));
  });

  it('keeps a private editable draft if a page write fails', async () => {
    Page.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));
    render(view());
    await duplicate();
    const edit = await screen.findByRole('link', { name: 'libraryLegacy.openCopy' });
    expect(edit.getAttribute('href')).toMatch(/BookCreation\?id=copy$/i);
    expect(Book.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', is_public: false, created_by: 'family-a' }));
    expect(Book.create.mock.calls[0][0]).not.toHaveProperty('printEdition');
    expect(Book.update).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
  });

  it('publishes after every readable page is written in order and ignores repeated activation', async () => {
    let finishPage;
    Page.create.mockImplementationOnce(() => new Promise(resolve => { finishPage = resolve; }));
    render(view());
    await duplicate();
    await waitFor(() => expect(Page.create).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'libraryLegacy.copying' }));
    expect(Book.create).toHaveBeenCalledTimes(1);
    expect(Book.update).not.toHaveBeenCalled();
    await act(async () => finishPage({}));
    await waitFor(() => expect(Book.update).toHaveBeenCalledWith('copy', { status: 'complete', total_pages: 2 }));
    expect(Page.create.mock.calls.map(([page]) => page.page_number)).toEqual([0, 1]);
    expect(Page.create.mock.calls[0][0]).not.toHaveProperty('generation_job');
  });

  it('offers the same draft for manual editing if the final status write fails', async () => {
    Book.update.mockRejectedValueOnce(new Error('status write failed'));
    render(view());
    await duplicate();
    expect(await screen.findByRole('link', { name: 'libraryLegacy.openCopy' })).toHaveAttribute('href', '/BookCreation?id=copy');
    expect(Book.create).toHaveBeenCalledTimes(1);
    expect(Page.create).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('libraryLegacy.complete')).toBeNull();
  });

  it('labels a source with zero readable pages as an editable draft', async () => {
    Page.filter.mockResolvedValueOnce([{ page_number: 0, text_content: ' ' }]);
    render(view());
    await duplicate();
    expect(await screen.findByText('libraryLegacy.emptyDraft')).toBeInTheDocument();
    expect(Book.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', total_pages: 0 }));
    expect(Page.create).not.toHaveBeenCalled();
    expect(Book.update).not.toHaveBeenCalled();
  });

  it('drops the previous family and stops pending work at the next write', async () => {
    let finishPage;
    Page.create.mockImplementationOnce(() => new Promise(resolve => { finishPage = resolve; }));
    const { rerender } = render(view());
    await duplicate();
    await waitFor(() => expect(Page.create).toHaveBeenCalledTimes(1));
    state.owner = 'family-b';
    rerender(view());
    expect(screen.queryByText('Original')).toBeNull();
    await act(async () => finishPage({}));
    expect(Page.create).toHaveBeenCalledTimes(1);
    expect(Book.update).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
  });
});
