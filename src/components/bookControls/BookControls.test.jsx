import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('@/components/i18n/i18nProvider', () => ({
  useI18n: () => ({ t: (k, r) => (r?.title ? `${k}|${r.title}` : k), isRTL: true }),
}));
const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
const unshareBook = vi.fn();
const deleteBook = vi.fn();
vi.mock('@/lib/ownerApi', () => ({ unshareBook: (...a) => unshareBook(...a), deleteBook: (...a) => deleteBook(...a) }));

import BookControls, { BookControlButton } from './BookControls';

const book = { id: 'b1', title: 'דוב והירח', is_public: true };
beforeEach(() => { vi.clearAllMocks(); cleanup(); });

describe('BookControls', () => {
  it('offers "stop sharing" only while the book is shared, and always "delete"', () => {
    const { rerender } = render(<BookControls book={book} onChanged={() => {}} />);
    expect(screen.getByRole('button', { name: /bookControls.stopShare/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bookControls.del/ })).toBeTruthy();
    rerender(<BookControls book={{ ...book, is_public: false }} onChanged={() => {}} />);
    expect(screen.queryByRole('button', { name: /bookControls.stopShare/ })).toBeNull();
    expect(screen.getByRole('button', { name: /bookControls.del/ })).toBeTruthy();
  });

  it('delete: confirmation names the book, does nothing until confirmed, then calls the server and reports', async () => {
    deleteBook.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(<BookControls book={book} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.del$/ }));
    expect(screen.getByText('bookControls.delTitle|דוב והירח')).toBeTruthy();
    expect(deleteBook).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.delConfirm' }));
    await waitFor(() => expect(deleteBook).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('delete'));
    expect(toast).toHaveBeenCalled();
  });

  it('delete: cancelling leaves everything alone', () => {
    render(<BookControls book={book} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.del$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.cancel' }));
    expect(deleteBook).not.toHaveBeenCalled();
  });

  it('delete: shows a busy state while the server works', async () => {
    let resolve;
    deleteBook.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<BookControls book={book} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.del$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.delConfirm' }));
    const busy = await screen.findByRole('button', { name: 'bookControls.delBusy' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.disabled).toBe(true);
    resolve({ ok: true });
  });

  it('delete: a server failure shows an error in the dialog, keeps it open and does not report success', async () => {
    deleteBook.mockRejectedValue(Object.assign(new Error('x'), { code: 'delete_failed_rows' }));
    const onChanged = vi.fn();
    render(<BookControls book={book} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.del$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.delConfirm' }));
    expect((await screen.findByRole('alert')).textContent).toContain('bookControls.delFailed');
    expect(screen.getByRole('button', { name: 'bookControls.delConfirm' })).toBeTruthy(); // can try again
    expect(onChanged).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('delete: an open print order gets its own explanation', async () => {
    deleteBook.mockRejectedValue(Object.assign(new Error('x'), { code: 'open_order' }));
    render(<BookControls book={book} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.del$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.delConfirm' }));
    expect((await screen.findByRole('alert')).textContent).toContain('bookControls.delOpenOrder');
  });

  it('stop sharing: confirms, calls unshare (not delete) and reports', async () => {
    unshareBook.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(<BookControlButton kind="unshare" book={book} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /bookControls.stopShare/ }));
    expect(screen.getByText('bookControls.stopShareTitle|דוב והירח')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bookControls.stopShareConfirm' }));
    await waitFor(() => expect(unshareBook).toHaveBeenCalledWith('b1'));
    expect(deleteBook).not.toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('unshare'));
  });
});
