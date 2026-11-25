import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savePageText } from './Page';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  book: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('./User', () => ({ User: { me: mocks.user } }));
vi.mock('./Book', () => ({ Book: { get: mocks.book } }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: mocks.from } }));

const input = { pageId: 'page-1', ownerId: 'owner', bookId: 'book-1', text: 'New text' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: 'owner' });
  mocks.book.mockResolvedValue({ id: 'book-1', created_by: 'owner' });
  for (const method of ['from', 'update', 'eq', 'is', 'select']) mocks[method].mockReturnValue(mocks);
});

describe('conditional page text update', () => {
  it.each([null, '', 'A, B. הספר'])('compares the exact server value %j in the write', async expectedText => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(savePageText({ ...input, expectedText })).resolves.toBeNull();
    expect(mocks.from).toHaveBeenCalledWith('pages');
    expect(mocks.update).toHaveBeenCalledWith({ text_content: 'New text' });
    expect(mocks.eq.mock.calls.slice(0, 3)).toEqual([
      ['id', 'page-1'], ['book_id', 'book-1'], ['created_by', 'owner'],
    ]);
    if (expectedText === null) expect(mocks.is).toHaveBeenCalledWith('text_content', null);
    else expect(mocks.eq).toHaveBeenCalledWith('text_content', expectedText);
    expect(mocks.select).toHaveBeenCalledWith('id, text_content');
  });

  it('rejects a stale authenticated owner or an unrelated parent book before mutation', async () => {
    mocks.user.mockResolvedValueOnce({ id: 'another-owner' });
    await expect(savePageText({ ...input, expectedText: '' })).rejects.toThrow('Authentication required');
    mocks.book.mockResolvedValueOnce({ id: 'book-1', created_by: 'another-owner' });
    await expect(savePageText({ ...input, expectedText: '' })).rejects.toThrow('Book unavailable');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
