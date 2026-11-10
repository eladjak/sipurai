// @vitest-environment node
// Privacy contract of public/sw.js: personal API data must never be cached or replayed.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SW_SOURCE = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://app.test';

function makeCaches({ failOpen = false } = {}) {
  const stores = new Map(); // name -> Map(url -> Response)
  const open = async (name) => {
    if (failOpen) throw new Error('storage unavailable');
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (req, res) => { if (res.status === 206) throw new TypeError('206 not cacheable'); m.set(typeof req === 'string' ? new URL(req, ORIGIN).href : req.url, res); },
      match: async (req) => {
        const r = m.get(typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);
        return r ? r.clone() : undefined;
      },
      addAll: async (urls) => { for (const u of urls) m.set(new URL(u, ORIGIN).href, new Response('shell')); },
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async (req) => {
      for (const m of stores.values()) {
        const r = m.get(typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);
        if (r) return r.clone();
      }
      return undefined;
    },
  };
}

function loadWorker({ fetchImpl, failOpen = false }) {
  const handlers = {};
  const caches = makeCaches({ failOpen });
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const location = { hostname: 'app.test' };
  new Function('self', 'caches', 'fetch', 'location', SW_SOURCE)(self, caches, fetchImpl, location);

  const fire = async (type, extra = {}) => {
    let pending;
    let responded = false;
    const writes = [];
    const event = {
      ...extra,
      waitUntil: (p) => { if (type === 'fetch') writes.push(p); else pending = p; },
      respondWith: (p) => { responded = true; pending = p; },
    };
    handlers[type](event);
    const value = await pending;
    await Promise.all(writes);
    return { responded, value };
  };
  const doFetch = (url, init = {}) => fire('fetch', { request: new Request(ORIGIN + url, init) });
  const nav = (p) => fire('fetch', { request: { method: 'GET', url: ORIGIN + p, mode: 'navigate', headers: new Headers(), destination: 'document' } });
  const allCachedUrls = () => [...caches.stores.values()].flatMap((m) => [...m.keys()]);
  return { caches, fire, doFetch, nav, allCachedUrls };
}

const navRequest = (p) => ({ method: 'GET', url: ORIGIN + p, mode: 'navigate', headers: new Headers(), destination: 'document' });
const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers });

describe('service worker privacy contract', () => {
  let online;
  beforeEach(() => { online = true; });
  const net = (make) => async (req) => {
    if (!online) throw new TypeError('network down');
    return make(req);
  };

  it('never caches or answers /api/* GETs, online or offline', async () => {
    const sw = loadWorker({ fetchImpl: net(() => json({ hasConsent: true })) });
    const a = await sw.doFetch('/api/privacy/consent');
    expect(a.responded).toBe(false); // passed straight to the network
    expect(sw.allCachedUrls().filter((u) => u.includes('/api/'))).toEqual([]);

    online = false;
    const b = await sw.doFetch('/api/privacy/consent');
    expect(b.responded).toBe(false); // offline: nothing is served from a cache
  });

  it('does not replay a legacy cached /api answer, even when the network is down', async () => {
    const sw = loadWorker({ fetchImpl: net(() => json({})) });
    const legacy = await sw.caches.open('sipurai-v1-api');
    await legacy.put(ORIGIN + '/api/library', json({ books: ['private'] }));
    online = false;
    const r = await sw.doFetch('/api/library');
    expect(r.responded).toBe(false);
  });

  it('does not cache a request that carries an Authorization header', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('x', { status: 200 })) });
    const r = await sw.doFetch('/assets/app.js', { headers: { Authorization: 'Bearer t' } });
    expect(r.responded).toBe(false);
    expect(sw.allCachedUrls()).toEqual([]);
  });

  it.each(['no-store', 'private, max-age=60', 'No-Store'])('does not cache a response with Cache-Control: %s', async (cc) => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('x', { status: 200, headers: { 'Cache-Control': cc } })) });
    await sw.doFetch('/assets/app.js');
    await sw.doFetch('/images/cover.png');
    await sw.fire('fetch', { request: navRequest('/some/page') });
    expect(sw.allCachedUrls()).toEqual([]);
  });

  it('does not cache unknown same-origin GETs', async () => {
    const sw = loadWorker({ fetchImpl: net(() => json({ secret: 1 })) });
    const r = await sw.doFetch('/export/profile.json');
    expect(r.responded).toBe(false);
    expect(sw.allCachedUrls()).toEqual([]);
  });

  it('deletes every older sipurai cache on activate (incl. the v1 api cache) and keeps unrelated ones', async () => {
    const sw = loadWorker({ fetchImpl: net(() => json({})) });
    for (const n of ['sipurai-v1-api', 'sipurai-v1-static', 'sipurai-v1-images', 'unrelated-cache']) {
      await sw.caches.open(n);
    }
    await sw.fire('install');
    await sw.fire('activate');
    const names = await sw.caches.keys();
    expect(names).not.toContain('sipurai-v1-api');
    expect(names).not.toContain('sipurai-v1-static');
    expect(names).not.toContain('sipurai-v1-images');
    expect(names).toContain('unrelated-cache');
    expect(names.some((n) => n.endsWith('-api'))).toBe(false);
  });

  it('still caches static assets and serves them offline', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('js', { status: 200, headers: { 'Cache-Control': 'public, max-age=31536000' } })) });
    const first = await sw.doFetch('/assets/app.js');
    expect(first.responded).toBe(true);
    expect(sw.allCachedUrls()).toContain(ORIGIN + '/assets/app.js');
    online = false;
    const again = await sw.doFetch('/assets/app.js');
    expect(await again.value.text()).toBe('js');
  });

  it('still precaches the offline shell and serves it for a failed navigation', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('', { status: 200 })) });
    await sw.fire('install');
    online = false;
    const r = await sw.fire('fetch', { request: navRequest('/library') });
    expect(r.responded).toBe(true);
    expect(await r.value.text()).toBe('shell');
  });
  it.each([
    '/api', '/api/', '/API/privacy/consent', '/api/x.svg', '/api/library.png', '/books/current/cover.png',
    '/export/profile.json', '/assets/app.js?token=abc', '/images/cover.png?child=7', '/images/a/b/c.png',
    '/demo/some-user-id/cover.webp', '/assets/%2e%2e/api/x.js', '/storage/v1/object/sign/covers/x.png',
    '/icons/../api/x.png', '/unknown.js', '/fonts/x.json',
  ])('network-only (no respondWith, nothing stored): %s', async (p) => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('PERSONAL', { status: 200 })) });
    const r = await sw.doFetch(p);
    expect(r.responded).toBe(false);
    expect(sw.allCachedUrls()).toEqual([]);
  });

  it.each([
    '/assets/index-D74aj6bk.js', '/assets/style-abc.css', '/fonts/Heebo-Regular.ttf', '/icons/icon-192x192.jpg',
    '/images/hero-banner.jpg', '/demo/demo-brave-fox/cover.webp', '/favicon.svg', '/manifest.json',
  ])('allowlisted static file is cached and replayed offline: %s', async (p) => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('STATIC', { status: 200 })) });
    await sw.doFetch(p);
    expect(sw.allCachedUrls()).toContain(ORIGIN + p);
    online = false;
    const again = await sw.doFetch(p);
    expect(await again.value.text()).toBe('STATIC');
  });

  it('never stores a navigation under its own URL; offline user B gets the shell, not user A page', async () => {
    const sw = loadWorker({ fetchImpl: net((req) => new Response(req.url.includes('/library') ? 'ALICE-CHILD-STORY' : 'shell-live', { status: 200 })) });
    await sw.fire('install');
    const a = await sw.nav('/library?child=7');
    expect(await a.value.text()).toBe('ALICE-CHILD-STORY');
    expect(sw.allCachedUrls().some((u) => u.includes('/library'))).toBe(false);
    online = false;
    const b = await sw.nav('/library?child=7');
    expect(await b.value.text()).toBe('shell');
  });

  it('refreshes the shell only from a 200, non-redirected home navigation', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('new-shell', { status: 200 })) });
    await sw.fire('install');
    await sw.nav('/');
    online = false;
    expect(await (await sw.nav('/anything')).value.text()).toBe('new-shell');
  });

  it('does not store a non-200 home navigation', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('oops', { status: 404 })) });
    await sw.fire('install');
    await sw.nav('/');
    online = false;
    expect(await (await sw.nav('/')).value.text()).toBe('shell');
  });

  it('does not store a redirected home navigation', async () => {
    const redirected = () => { const r = new Response('login-page', { status: 200 }); Object.defineProperty(r, 'redirected', { value: true }); return r; };
    const sw = loadWorker({ fetchImpl: net(redirected) });
    await sw.fire('install');
    await sw.nav('/');
    online = false;
    expect(await (await sw.nav('/')).value.text()).toBe('shell');
  });

  it('bypasses Range requests and never stores a 206', async () => {
    const sw = loadWorker({ fetchImpl: net(() => new Response('part', { status: 206 })) });
    const ranged = await sw.doFetch('/images/hero-banner.jpg', { headers: { Range: 'bytes=0-9' } });
    expect(ranged.responded).toBe(false);
    await sw.doFetch('/images/hero-banner.jpg');
    expect(sw.allCachedUrls()).toEqual([]);
  });

  it('a broken cache never breaks a request the network can serve', async () => {
    const sw = loadWorker({ failOpen: true, fetchImpl: net(() => new Response('live', { status: 200 })) });
    const asset = await sw.doFetch('/assets/app.js');
    expect(await asset.value.text()).toBe('live');
    const page = await sw.nav('/library');
    expect(await page.value.text()).toBe('live');
  });
});
