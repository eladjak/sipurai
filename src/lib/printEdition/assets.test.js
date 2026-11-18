import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ file: vi.fn(), generate: vi.fn(), auth: vi.fn() }));
vi.mock('jszip', () => ({ default: class {
  file = fixture.file;
  generateAsync = fixture.generate;
} }));
vi.mock('@/lib/apiAuth', () => ({ getApiAuthHeaders: fixture.auth }));
import { downloadEditionBundle } from './assets';
import { editionDraft } from './model';

const cover = '/api/img?p=generated/cover.png';
const scene = '/api/img?p=generated/story.png';
const closing = 'https://images.example/closing.png';
const book = { id: '12345678-1234-1234-1234-123456789012', title: 'ספר', language: 'hebrew', cover_image: cover };
const pages = [{ id: 'story', text_content: 'שלום עולם', image_url: scene }];
const edition = editionDraft({ version: 1, revision: 4, creator: 'משפחה', blurb: 'תיאור', artwork: { closingArt: closing },
  pages: { story: { source: 'שלום עולם', text: 'שלום עולם', approval: { mode: 'unpointed', text: 'שלום עולם' } } } });
const artwork = new Map();
const fetchImage = vi.fn();
const launch = vi.fn();
const handoffCheck = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  artwork.clear();
  for (const image of [cover, scene, closing]) artwork.set(image, image);
  let token = 0;
  fixture.auth.mockImplementation(async () => ({ Authorization: 'Bearer token-' + ++token }));
  fetchImage.mockImplementation(async url => ({ ok: true, blob: async () => new NodeBlob([artwork.get(url)], { type: 'image/png' }) }));
  vi.stubGlobal('fetch', fetchImage);
  fixture.generate.mockResolvedValue(new NodeBlob(['staged archive']));
  handoffCheck.mockResolvedValue(undefined);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:staged-archive');
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(launch);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('private print source export at commit time', () => {
  it('reads each mutable asset twice and refreshes the auth header for every private read', async () => {
    await downloadEditionBundle(book, pages, edition, handoffCheck);
    const privateReads = fetchImage.mock.calls.filter(([url]) => url.startsWith('/api/img?'));
    expect(privateReads.map(([, options]) => options.headers.Authorization)).toEqual([
      'Bearer token-1', 'Bearer token-2', 'Bearer token-3', 'Bearer token-4',
    ]);
    const externalReads = fetchImage.mock.calls.filter(([url]) => url === closing);
    expect(externalReads).toHaveLength(2);
    expect(externalReads.every(([, options]) => options.credentials === 'omit' && !options.headers)).toBe(true);
    expect(fetchImage.mock.calls.every(([, options]) => options.cache === 'no-store')).toBe(true);
    expect(handoffCheck).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledOnce();
    const [, json] = fixture.file.mock.calls.find(([path]) => path === 'edition.json');
    expect(JSON.parse(json)).not.toHaveProperty('endpaperArt');
  });

  it('discards the completed archive if artwork changes at the same URL during compression', async () => {
    fixture.generate.mockImplementationOnce(async () => {
      artwork.set(closing, 'mutated artwork');
      return new NodeBlob(['stale archive']);
    });
    await expect(downloadEditionBundle(book, pages, edition, handoffCheck)).rejects.toThrow('conflict');
    expect(launch).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('verifies the revision after archive generation and fresh image reads, before preparing any download URL', async () => {
    let currentRevision = edition.revision;
    fixture.generate.mockImplementationOnce(async () => {
      currentRevision++;
      return new NodeBlob(['stale archive']);
    });
    handoffCheck.mockImplementation(async () => {
      expect(fetchImage).toHaveBeenCalledTimes(6);
      if (currentRevision !== edition.revision) throw new Error('conflict');
    });
    await expect(downloadEditionBundle(book, pages, edition, handoffCheck)).rejects.toThrow('conflict');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });

  it('keeps an explicit owner endpaper in the manifest using the same verified art reference', async () => {
    await downloadEditionBundle(book, pages, { ...edition, artwork: { closingArt: closing, endpaperArt: closing } }, handoffCheck);
    const [, json] = fixture.file.mock.calls.find(([path]) => path === 'edition.json');
    expect(JSON.parse(json).endpaperArt).toBe(JSON.parse(json).closingArt);
    expect(fetchImage.mock.calls.filter(([url]) => url === closing)).toHaveLength(2);
  });
});
