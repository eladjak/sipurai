import { describe, it, expect } from 'vitest';
import { imageProxyUrl, toAppImageUrl } from './imageUrl';

const PUB = 'https://furviizyohryyqubosut.supabase.co/storage/v1/object/public/sipurai-images/';

describe('imageUrl', () => {
  it('builds the proxy url with / encoded', () => {
    expect(imageProxyUrl('generated/a-1.png')).toBe('/api/img?p=generated%2Fa-1.png');
  });
  it('maps an old public url to the proxy form', () => {
    expect(toAppImageUrl(PUB + 'generated/a-1.png')).toBe('/api/img?p=generated%2Fa-1.png');
  });
  it('drops a query string and decodes an encoded path', () => {
    expect(toAppImageUrl(PUB + 'generated%2Fa-1.png?t=5')).toBe('/api/img?p=generated%2Fa-1.png');
  });
  it('is idempotent', () => {
    const once = toAppImageUrl(PUB + 'uploads/x.jpg');
    expect(toAppImageUrl(once)).toBe(once);
  });
  it('leaves other urls and non-strings unchanged', () => {
    expect(toAppImageUrl('https://img.clerk.com/abc.png')).toBe('https://img.clerk.com/abc.png');
    expect(toAppImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(toAppImageUrl(undefined)).toBe(undefined);
    expect(toAppImageUrl(null)).toBe(null);
    expect(toAppImageUrl('')).toBe('');
  });
});
