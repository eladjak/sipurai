/**
 * Sipurai Service Worker. Only explicitly allowlisted public static assets
 * enter Cache Storage. Navigations go to the network with HTTP revalidation,
 * so an old document cannot keep referencing a removed deployment's bundles.
 * Offline navigations get a standalone page with no bundle dependencies.
 */

const CACHE_VERSION = 'sipurai-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const OFFLINE_URL = '/offline.html';

// Static assets to precache on install
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
];

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────
// Delete every cache of an older version, including the v1 "-api" cache that held personal
// API answers, so existing devices are cleaned the next time they load the app.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('sipurai-') && name !== STATIC_CACHE && name !== IMAGE_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

// ─── Allowlist ───────────────────────────────────────────────────────────────

const SHELL_PATHS = new Set(PRECACHE_URLS);
const ASSET_RE = /^\/assets\/[A-Za-z0-9._-]+\.(js|css|woff2?|ttf|png|jpe?g|webp|svg|gif)$/;
const FONT_RE = /^\/fonts\/[A-Za-z0-9._-]+\.(woff2?|ttf)$/;
const ICON_RE = /^\/icons\/[A-Za-z0-9._-]+\.(png|jpe?g|svg)$/;
const IMAGE_RE = /^\/images\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg|gif)$/;
const DEMO_RE = /^\/demo\/demo-[a-z-]+\/[A-Za-z0-9._-]+\.(webp|jpe?g|png)$/;

// Returns the cache name for an allowlisted static URL, or null (= network-only).
function cacheFor(url) {
  if (url.search || url.hash) return null; // a query string can be a token or an id
  const p = url.pathname;
  if (p.includes('%') || p.includes('..') || p.includes('//')) return null;
  if (SHELL_PATHS.has(p)) return STATIC_CACHE;
  if (ASSET_RE.test(p) || FONT_RE.test(p)) return STATIC_CACHE;
  if (ICON_RE.test(p) || IMAGE_RE.test(p) || DEMO_RE.test(p)) return IMAGE_CACHE;
  return null;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== location.origin) return; // external services: browser handles them

  // Never touch ranged requests or requests that carry credentials in a header.
  if (request.headers.has('Range') || request.headers.has('Authorization')) return;

  // Keep API and authentication navigations entirely outside the worker.
  if (request.mode === 'navigate') {
    if (/^\/(?:api|sign-in|sign-up)(?:\/|$)/i.test(url.pathname)) return;
    event.respondWith(navigationHandler(request));
    return;
  }

  // Static allowlist only. Anything else: no respondWith => straight to the network.
  const cacheName = cacheFor(url);
  if (!cacheName) return;
  event.respondWith(cacheFirst(event, request, cacheName));
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function safeMatch(cacheName, key) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(key);
  } catch {
    return undefined;
  }
}

function safePut(event, cacheName, key, response) {
  const write = caches
    .open(cacheName)
    .then((cache) => cache.put(key, response))
    .catch(() => {});
  event.waitUntil(write);
}

async function cacheFirst(event, request, cacheName) {
  const cached = await safeMatch(cacheName, request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // A missing bundle can be rewritten to index.html with HTTP 200.
    const isHtml = /^text\/html\b/i.test(response.headers.get('Content-Type') || '');
    if (isCacheable(response) && (!isHtml || new URL(request.url).pathname === OFFLINE_URL)) {
      safePut(event, cacheName, request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function navigationHandler(request) {
  try {
    return await fetch(request, { cache: 'no-cache' });
  } catch {
    const offlinePage = await safeMatch(STATIC_CACHE, OFFLINE_URL);
    return offlinePage || new Response('אין חיבור לאינטרנט. בדקו את החיבור ורעננו את העמוד.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Only complete (200) responses that did not ask to stay out of persistent caches.
function isCacheable(response) {
  if (!response || response.status !== 200) return false;
  const cc = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (/(^|[\s,])(no-store|private)([\s,=]|$)/.test(cc)) return false;
  if ((response.headers.get('Vary') || '').includes('*')) return false;
  return true;
}
