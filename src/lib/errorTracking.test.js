import { describe, it, expect } from 'vitest';
import { scrubEvent } from './errorTracking';

describe('scrubEvent (Sentry beforeSend PII filter)', () => {
  it('keeps only the anonymous user id', () => {
    const out = scrubEvent({ user: { id: 'u1', email: 'a@b.c', username: 'x' } });
    expect(out.user).toEqual({ id: 'u1' });
  });

  it('scrubs breadcrumbs when Sentry hands them over as an ARRAY (the real shape)', () => {
    const event = {
      breadcrumbs: [
        { message: 'click', data: { email: 'a@b.c', name: 'Dana', username: 'd', page: '/Home' } },
        { message: 'nav' },
      ],
    };
    const out = scrubEvent(event);
    expect(out).toBeTruthy();
    expect(out.breadcrumbs[0].data).toEqual({});
    expect(out.breadcrumbs[0].message).toBeUndefined();
    expect(out.breadcrumbs[1].message).toBeUndefined();
  });

  it('still scrubs the legacy { values: [...] } shape', () => {
    const out = scrubEvent({ breadcrumbs: { values: [{ data: { email: 'a@b.c', ok: 1 } }] } });
    expect(out.breadcrumbs.values[0].data).toEqual({});
  });

  it('drops free text and query strings, keeps technical fields', () => {
    const out = scrubEvent({
      request: { url: 'https://www.sipurai.ai/BookView?id=7&child=Dana', query_string: 'child=Dana', cookies: 'a=b', headers: { Referer: 'https://x?name=Dana' } },
      breadcrumbs: [
        { category: 'console', message: 'Dana opened her book', data: { arguments: ['Dana'] } },
        { category: 'fetch', data: { url: '/api/ai/generate?prompt=Dana', method: 'POST', status_code: 200, body: 'Dana' } },
        { category: 'ui.click', message: 'div.card > button' },
      ],
    });
    expect(out.request.url).toBe('https://www.sipurai.ai/BookView');
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.headers.Referer).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Dana');
    expect(out.breadcrumbs[1].data).toEqual({ url: '/api/ai/generate', method: 'POST', status_code: 200 });
    expect(out.breadcrumbs[2].message).toBe('div.card > button');
  });

  it('never throws, so the event is not dropped', () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(() => scrubEvent({ breadcrumbs: [] })).not.toThrow();
  });
});
