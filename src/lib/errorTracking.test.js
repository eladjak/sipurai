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
    expect(out.breadcrumbs[0].data).toEqual({ page: '/Home' });
    expect(out.breadcrumbs[1]).toEqual({ message: 'nav' });
  });

  it('still scrubs the legacy { values: [...] } shape', () => {
    const out = scrubEvent({ breadcrumbs: { values: [{ data: { email: 'a@b.c', ok: 1 } }] } });
    expect(out.breadcrumbs.values[0].data).toEqual({ ok: 1 });
  });

  it('never throws, so the event is not dropped', () => {
    expect(() => scrubEvent({})).not.toThrow();
    expect(() => scrubEvent({ breadcrumbs: [] })).not.toThrow();
  });
});
