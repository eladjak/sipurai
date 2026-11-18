import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchImageAsBase64 } from '../bookGeneration';
import { getApiAuthHeaders } from '../apiAuth';

vi.mock('../apiAuth', () => ({ getApiAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer synthetic-test' })) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close() {} })));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1,2,3]), {
    headers: { 'Content-Type': 'image/webp' },
  })));
});
afterEach(() => vi.unstubAllGlobals());

it('authenticates only the same-origin private image route', async () => {
  expect(await fetchImageAsBase64('/api/img?p=generated%2Fpicture.webp')).toBe('AQID');
  expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({headers: {Authorization: 'Bearer synthetic-test'}, redirect: 'error'});
  await fetchImageAsBase64('https://images.example.org/api/img?p=public');
  expect(getApiAuthHeaders).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[1][1]).not.toHaveProperty('headers');
});

it('requires actual decodable image content before declaring artwork ready', async () => {
  vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('corrupt pixels'));
  expect(await fetchImageAsBase64('/demo/broken.webp')).toBeNull();
  vi.mocked(fetch).mockResolvedValueOnce(new Response('Sign in', {headers: {'Content-Type':'text/html'}}));
  expect(await fetchImageAsBase64('/demo/login')).toBeNull();
});
