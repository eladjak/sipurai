import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savePageText } from './Page';

const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn() }));

vi.mock('./User', () => ({ User: { me: mocks.user } }));
vi.mock('../lib/supabaseClient', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://supabase.example.invalid', 'synthetic-anon-key', {
      global: { fetch: mocks.fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
});

const input = { pageId: 'page-1', ownerId: 'owner', bookId: 'book-1', text: 'טקסט לדוגמה' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: 'owner' });
});

describe('conditional page text RPC', () => {
  it.each([null, '', 'א'.repeat(16000)])('POSTs the expected page in the body only', async expectedText => {
    mocks.fetch.mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } }));
    await expect(savePageText({ ...input, expectedText })).resolves.toBeNull();
    expect(mocks.fetch.mock.calls.length).toBe(1);
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(String(url)).toBe('https://supabase.example.invalid/rest/v1/rpc/sipurai_save_page_text');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.p_expected_text === expectedText).toBe(true);
    expect(body.p_text === input.text).toBe(true);
    expect([body.p_page_id, body.p_book_id, body.p_owner_id]).toEqual(['page-1', 'book-1', 'owner']);
  });

  it('returns only confirmed saves', async () => {
    const saved = { id: input.pageId, text_content: input.text };
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify([saved]), { headers: { 'content-type': 'application/json' } }));
    await expect(savePageText({ ...input, expectedText: '' })).resolves.toEqual(saved);
  });

  it('rejects a stale authenticated owner before sending the request', async () => {
    mocks.user.mockResolvedValueOnce({ id: 'another-owner' });
    await expect(savePageText({ ...input, expectedText: '' })).rejects.toThrow('Authentication required');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
