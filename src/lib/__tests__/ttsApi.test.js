import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../api/_lib/verifyClerk.js', () => ({
  requireClerkAuth: async () => ({ ok: true }),
}));

import handler from '../../../api/ai/tts.js';

function mockRes() {
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.sent = b; return this; },
    end() { return this; },
  };
}
const req = (body) => ({ method: 'POST', headers: { origin: 'https://sipurai.ai', 'x-forwarded-for': `t${Math.random()}` }, body });
const geminiOk = () => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from('pcm').toString('base64') } }] } }] }),
});
const openaiOk = () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('mp3bytes').buffer });
const fail = (status) => ({ ok: false, status, text: async () => 'gone' });

describe('api/ai/tts gemini provider', () => {
  let fetchMock;
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    vi.stubEnv('OPENAI_API_KEY', 'ok');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the registry model (not the retiring preview id) and returns WAV', async () => {
    fetchMock.mockResolvedValueOnce(geminiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'שלום' }), res);
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-3.8-flash-tts:generateContent');
    expect(res.code).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/wav');
    expect(res.headers['X-TTS-Fallback']).toBeUndefined();
  });

  it('honours the GEMINI_TTS_MODEL env override', async () => {
    vi.stubEnv('GEMINI_TTS_MODEL', 'gemini-3.8-flash-lite-tts');
    fetchMock.mockResolvedValueOnce(geminiOk());
    await handler(req({ provider: 'gemini', text: 'x' }), mockRes());
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-3.8-flash-lite-tts:');
  });

  it.each([404, 500, 429])('falls back to OpenAI TTS when Gemini answers %i', async (status) => {
    fetchMock.mockResolvedValueOnce(fail(status)).mockResolvedValueOnce(openaiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'שלום', voice: 'Aoede' }), res);
    expect(res.code).toBe(200);
    expect(res.headers['X-TTS-Fallback']).toBe('openai');
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('gpt-4o-mini-tts');
    expect(sent.voice).toBe('nova'); // Gemini voice names are not valid OpenAI voices
  });

  it('falls back when Gemini returns no audio', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'no audio' }] } }] }) })
      .mockResolvedValueOnce(openaiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.headers['X-TTS-Fallback']).toBe('openai');
  });

  it('falls back to OpenAI when the Gemini key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    fetchMock.mockResolvedValueOnce(openaiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.code).toBe(200);
    expect(res.headers['X-TTS-Fallback']).toBe('openai');
  });

  it('returns the Gemini error (502) when Gemini fails and OpenAI is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    fetchMock.mockResolvedValueOnce(fail(500));
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.code).toBe(502);
    expect(res.body.error).toMatch(/Gemini TTS failed/);
  });

  it('surfaces an error (not silence) when both providers fail', async () => {
    fetchMock.mockResolvedValueOnce(fail(404)).mockResolvedValueOnce(fail(500));
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.code).toBe(502);
    expect(res.body.error).toMatch(/OpenAI TTS failed/);
  });

  it('does not touch Gemini for the openai provider', async () => {
    fetchMock.mockResolvedValueOnce(openaiOk());
    await handler(req({ provider: 'openai', text: 'x' }), mockRes());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('openai.com');
  });

  it('treats an empty inlineData payload as a failure and falls back', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: '' } }] } }] }) })
      .mockResolvedValueOnce(openaiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.headers['X-TTS-Fallback']).toBe('openai');
  });

  it('passes an abort signal to the Gemini call and falls back when it times out', async () => {
    fetchMock
      .mockImplementationOnce((_url, init) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return Promise.reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
      })
      .mockResolvedValueOnce(openaiOk());
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(res.headers['X-TTS-Fallback']).toBe('openai');
  });

  it('never echoes the upstream error body to the client', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'SECRET_CANARY_9f32' });
    const res = mockRes();
    await handler(req({ provider: 'gemini', text: 'x' }), res);
    expect(JSON.stringify(res.body)).not.toContain('SECRET_CANARY_9f32');
  });
});
