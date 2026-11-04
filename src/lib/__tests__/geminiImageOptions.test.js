import { describe, it, expect, vi, afterEach } from 'vitest';
import { geminiProImage } from '../../../api/ai/gemini-image.js';

const ok = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: 'AAAA' } }] } }] }) };

describe('gemini-image thinking options follow the model, not the chain position', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('does not send thinkingConfig when the primary is overridden to a flash model', async () => {
    vi.stubEnv('GEMINI_PRO_IMAGE_MODEL', 'gemini-2.5-flash-image');
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal('fetch', fetchMock);
    await geminiProImage('k', 'p');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('still sends thinkingConfig for the default pro model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal('fetch', fetchMock);
    await geminiProImage('k', 'p');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toBeDefined();
  });
});
