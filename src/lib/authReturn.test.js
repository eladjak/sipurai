import { describe, expect, it } from 'vitest';
import { authLink, safeAuthReturn } from './authReturn';
describe('local authentication return', () => {
  it('preserves path, query and hash through sign-in and sign-up links', () => {
    const target = '/b/print/abcdef?view=1#read';
    expect(new URLSearchParams(authLink('/sign-up', target).split('?')[1]).get('redirect_url')).toBe(target);
    expect(safeAuthReturn(target)).toBe(target);
    expect(safeAuthReturn('/pricing?plan=lite')).toBe('/pricing?plan=lite');
  });
  it.each(['//evil.example', '/%2f%2fevil.example', '/%5cevil.example', '/\\evil.example', 'https://evil.example', '/\nevil', null])('rejects unsafe return %s', target => expect(safeAuthReturn(target)).toBe('/'));
});
