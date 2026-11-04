import { describe, it, expect, vi, afterEach } from 'vitest';
import { geminiProImage } from '../../../api/ai/gemini-image.js';

const blocked = (finishReason) => ({
  ok: true,
  json: async () => ({ candidates: [{ finishReason }] }),
});

describe('gemini-image content blocks stop the whole fallback chain', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  for (const reason of ['SAFETY', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']) {
    it(`${reason} gives a 422 after exactly one call`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(blocked(reason));
      vi.stubGlobal('fetch', fetchMock);
      await expect(geminiProImage('k', 'p')).rejects.toMatchObject({ status: 422 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  }
});
