import { Blob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProofClient } from './proofClient';

const { auth, readArt } = vi.hoisted(() => ({ auth: vi.fn(), readArt: vi.fn() }));
vi.mock('@/lib/apiAuth', () => ({ getApiAuthHeaders: auth }));
vi.mock('./assets', () => ({ readEditionArt: readArt }));

const image = () => new Blob(['image'], { type: 'image/webp' });
const prepared = () => ({ ok: true, json: async () => ({ job: 'job', session: 'session', missing: [] }) });
const rendered = () => ({ ok: true, json: async () => ({ proof: {
  coverFile: 'cover.webp', pages: [{ file: 'page-01.webp' }, { file: 'page-02.webp' }],
} }) });
const preview = () => ({ ok: true, blob: async () => image() });
const fetchMock = vi.fn();
const createUrl = vi.fn();
const revokeUrl = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createUrl;
    static revokeObjectURL = revokeUrl;
  });
  auth.mockResolvedValue({});
  readArt.mockResolvedValue(image());
  createUrl.mockReturnValue('blob:proof');
  fetchMock.mockImplementation(async (_url, options) => {
    const op = options.body && JSON.parse(options.body).op;
    if (op === 'prepare') return prepared();
    if (op === 'render') return rendered();
    return preview();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('proof render attempt lifecycle', () => {
  it('reports a hung auth request, blocks late network work, then renders on retry', async () => {
    let finishAuth;
    auth.mockImplementationOnce(() => new Promise(resolve => { finishAuth = resolve; }));
    const stage = vi.fn();
    const render = createProofClient();
    const parent = new AbortController();
    const first = render('book', {}, [], parent.signal, 0, stage);
    const failure = expect(first).rejects.toMatchObject({ code: 'proof_timeout' });
    await vi.advanceTimersByTimeAsync(16_000);
    await failure;
    expect(stage.mock.calls.flat()).toEqual(['artwork', 'prepare']);

    finishAuth({});
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    const proof = await render('book', {}, [], parent.signal, 0, stage);
    expect(proof.pages.map(page => page.url)).toEqual(['blob:proof', 'blob:proof']);
    expect(stage.mock.calls.flat().slice(2)).toEqual(['artwork', 'prepare', 'render', 'preview']);
    proof.revoke();
    expect(revokeUrl).toHaveBeenCalledTimes(3);
  });

  it('cancels stalled artwork when the edition changes', async () => {
    readArt.mockImplementationOnce(() => new Promise(() => {}));
    const controller = new AbortController();
    const first = createProofClient()('book', {}, ['/art.png'], controller.signal);
    const failure = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await failure;
    expect(readArt.mock.calls[0][1].aborted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries after artwork is repaired', async () => {
    readArt.mockRejectedValueOnce(new Error('Image unavailable'));
    const render = createProofClient();
    const { signal } = new AbortController();
    await expect(render('book', {}, ['/art.png'], signal)).rejects.toMatchObject({ code: 'proof_artwork' });
    expect(fetchMock).not.toHaveBeenCalled();
    const proof = await render('book', {}, ['/art.png'], signal);
    expect(proof.coverUrl).toBe('blob:proof');
    proof.revoke();
  });

  it('revokes a loaded page when a sibling fails and ignores a response arriving after cancellation', async () => {
    let releasePage;
    let rejectPage;
    let pendingSignal;
    fetchMock.mockResolvedValueOnce(prepared()).mockResolvedValueOnce(rendered())
      .mockResolvedValueOnce(preview())
      .mockImplementationOnce((_url, options) => {
        pendingSignal = options.signal;
        return new Promise(resolve => { releasePage = resolve; });
      })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPage = reject; }));
    const render = createProofClient();
    const first = render('book', {}, [], new AbortController().signal);
    const failure = expect(first).rejects.toThrow('Missing page');
    await vi.advanceTimersByTimeAsync(0);
    expect(createUrl).toHaveBeenCalledOnce();
    rejectPage(new Error('Missing page'));
    await failure;
    expect(pendingSignal.aborted).toBe(true);
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:proof');
    releasePage(preview());
    await vi.advanceTimersByTimeAsync(0);
    expect(createUrl).toHaveBeenCalledOnce();
  });
});
