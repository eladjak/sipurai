/**
 * Sipurai Service Worker — offline support with caching strategies.
 *
 * - Cache-first for static assets (JS, CSS, images, fonts)
 * - Network-first for API calls
 * - Offline fallback page for navigation requests
 */

const CACHE_VERSION = 'sipurai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
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
// Clean up old caches when a new version is deployed.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('sipurai-') && name !== STATIC_CACHE && name !== API_CACHE && name !== IMAGE_CACHE)
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

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Images: cache-first with long expiry
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

  // Everything else: network-first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try to serve cached version of the page
    const cached = await caches.match(request);
    if (cached) return cached;

    // Try the root page (SPA)
    const rootCached = await caches.match('/');
    if (rootCached) return rootCached;

    // Last resort: offline fallback page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
