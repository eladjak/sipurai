import { describe, expect, it, vi } from 'vitest';
import { unshareBook } from './ownerApi';

const getHeaders = async () => ({ Authorization: 'Bearer fixture' });

describe('unshare response', () => {
  it.each([null, {}, { ok: true }, { ok: true, removedPosts: -1 }, { ok: false, removedPosts: 0 }])(
    'rejects an unconfirmed success response %j',
    async (body) => {
      const fetchImpl = vi.fn(async () => Response.json(body));
      await expect(unshareBook('fixture-book', { fetchImpl, getHeaders }))
        .rejects.toMatchObject({ code: 'invalid_response' });
    },
  );

  it('accepts a confirmed revoke even when no community listing existed', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, removedPosts: 0 }));
    await expect(unshareBook('fixture-book', { fetchImpl, getHeaders }))
      .resolves.toEqual({ ok: true, removedPosts: 0 });
  });
});
