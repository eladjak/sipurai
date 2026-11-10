/**
 * Sipurai Service Worker — offline support for the PUBLIC app shell only.
 *
 * - Cache-first for static assets (JS, CSS, fonts) and same-origin images
 * - Offline fallback page for navigation requests
 * - /api/* is NEVER cached and NEVER answered from a cache: it carries parents' and children's
 *   personal data, and a shared device must not hand one person's answers to the next person.
 *   (v1 cached it network-first, keyed by URL only, and ignored Cache-Control: no-store.)
 * - Nothing is stored for a request carrying an Authorization header, or for a response that
 *   says Cache-Control: no-store / private, or Vary: *.
 *
 * Bump CACHE_VERSION to make every device drop the caches of older versions on activation.
 */

const CACHE_VERSION = 'sipurai-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const OFFLINE_URL = '/offline.html';

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
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
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, browser-sync, etc.
  if (!url.protocol.startsWith('http')) return;

  // Skip external services — let browser handle directly
  if (url.hostname !== location.hostname) return;

  // Auth routes — always pass directly to the network, never cache
  if (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up')) {
    return; // let the browser handle it
  }

  // API calls: straight to the network. No respondWith, so the browser makes the request itself,
  // nothing is stored, nothing is read from any cache, and a network failure stays a failure.
  if (url.pathname.startsWith('/api/')) return;

  // A request that carries credentials in a header is never ours to cache or replay.
  if (request.headers.has('Authorization')) return;

  // Images: cache-first
  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets (JS, CSS, fonts): cache-first
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Everything else (unknown same-origin GETs): straight to the network, never cached.
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);

    // Try to serve cached version of the page
    const cached = await cache.match(request);
    if (cached) return cached;

    // Try the root page (SPA)
    const rootCached = await cache.match('/');
    if (rootCached) return rootCached;

    // Last resort: offline fallback page
    const offlinePage = await cache.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Only successful responses that did not ask to stay out of shared/persistent caches.
function isCacheable(response) {
  if (!response || !response.ok) return false;
  const cc = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (/(^|[\s,])(no-store|private)([\s,=]|$)/.test(cc)) return false;
  if ((response.headers.get('Vary') || '').includes('*')) return false;
  return true;
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname) ||
    request.destination === 'image';
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font';
}
