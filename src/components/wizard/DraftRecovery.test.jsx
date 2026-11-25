import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DraftRecovery from './DraftRecovery';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn() } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn() } }));
const t = key => key;
const renderRecovery = (props = {}) => render(<MemoryRouter><DraftRecovery ownerId="owner" attemptId="a&b" t={t} {...props} /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
describe('read-only draft recovery', () => {
  it('opens only the exact owned readable book with an encoded id', async () => {
    Book.filter.mockResolvedValue([{ id: 'a&b', created_by: 'owner', total_pages: 2 }]);
    Page.filter.mockResolvedValue([{ book_id: 'a&b', page_number: 1, text_content: 'Hello' }]);
    renderRecovery();
    expect((await screen.findByRole('link', { name: 'spxWizard.recovery.open' })).getAttribute('href')).toBe('/BookView?id=a%26b');
    expect(Book.filter).toHaveBeenCalledWith({ id: 'a&b', created_by: 'owner' });
    expect(Page.filter).toHaveBeenCalledWith({ book_id: 'a&b' }, 'page_number');
  });
  it.each([
    { kind: 'missing row', matches: [] },
    { kind: 'different owner', matches: [{ id: 'a&b', created_by: 'other' }] },
    { kind: 'different book', matches: [{ id: 'other', created_by: 'owner' }] },
  ])('does not read pages for a $kind', async ({ matches }) => {
    Book.filter.mockResolvedValue(matches); renderRecovery();
    await screen.findByText('spxWizard.recovery.unavailable'); expect(Page.filter).not.toHaveBeenCalled();
  });
  it('does not query when no owner is available', async () => {
    renderRecovery({ ownerId: null });
    expect(Book.filter).not.toHaveBeenCalled(); expect(Page.filter).not.toHaveBeenCalled();
  });
  it('treats a failed lookup as unverified and allows only a read retry', async () => {
    Book.filter.mockRejectedValue(new Error('404')); renderRecovery();
    await screen.findByText('spxWizard.recovery.unavailable');
    expect(Page.filter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'spxWizard.recovery.retry' }));
    await waitFor(() => expect(Book.filter).toHaveBeenCalledTimes(2));
  });
  it('shows no readable link for skeleton pages and retries reads only', async () => {
    Book.filter.mockResolvedValue([{ id: 'a&b', created_by: 'owner' }]);
    Page.filter.mockResolvedValue([{ book_id: 'a&b', page_number: 1, text_content: ' ' }]);
    renderRecovery(); await screen.findByText('spxWizard.recovery.noPages');
    expect(screen.queryByRole('link', { name: 'spxWizard.recovery.open' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'spxWizard.recovery.retry' }));
    await waitFor(() => expect(Book.filter).toHaveBeenCalledTimes(2));
  });
  it('does not expose a delayed result after account or draft transition', async () => {
    let resolve; Book.filter.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue([]);
    const { rerender } = renderRecovery();
    rerender(<MemoryRouter><DraftRecovery ownerId="other" attemptId="new" t={t} /></MemoryRouter>);
    await screen.findByText('spxWizard.recovery.unavailable');
    resolve([{ id: 'a&b', created_by: 'owner' }]);
    await waitFor(() => expect(Page.filter).not.toHaveBeenCalled());
  });
  it('hides a previous result while offline and checks again on reconnect', async () => {
    Book.filter.mockResolvedValue([{ id: 'a&b', created_by: 'owner' }]); Page.filter.mockResolvedValue([{ book_id: 'a&b', page_number: 1, text_content: 'Hello' }]);
    renderRecovery(); await screen.findByRole('link', { name: 'spxWizard.recovery.open' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); fireEvent(window, new Event('offline'));
    expect(screen.getByText('spxWizard.recovery.offline')).toBeTruthy(); expect(screen.queryByRole('link', { name: 'spxWizard.recovery.open' })).toBeNull();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); fireEvent(window, new Event('online'));
    await waitFor(() => expect(Book.filter).toHaveBeenCalledTimes(2));
  });
});
