/**
 * Sipurai Service Worker — offline support for the PUBLIC app shell only.
 *
 * POSITIVE ALLOWLIST. The worker stores and replays ONLY:
 *   - the shell files precached at install (/, /offline.html, /manifest.json, /favicon.svg, /entry-splash.js)
 *   - build output under /assets/ (hashed JS/CSS/fonts/images)
 *   - the app's own static files under /fonts/, /icons/, /images/ and the public demo books /demo/<demo-slug>/
 * and only when the URL has no query string. Everything else (every /api path in any spelling,
 * anything with a query, anything id-like, any storage URL, unknown paths) is network-only:
 * the worker does not even call respondWith, so nothing is stored and nothing is replayed.
 *
 * Navigations: the SPA shell is identical for everyone (Vercel serves static index.html for every
 * non-/api path; no server-side rendering, no cookies in the HTML). A navigation is never stored
 * under its own URL. Online it goes to the network untouched; offline it gets the single shell
 * ('/') or the offline page. The shell is refreshed only from a 200, non-redirected '/' response.
 *
 * Cache access is best effort: a storage failure never breaks a request that the network can serve.
 * Range requests and 206 responses are never cached.
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

// ─── Allowlist ───────────────────────────────────────────────────────────────

const SHELL_PATHS = new Set(['/', '/offline.html', '/manifest.json', '/favicon.svg', '/entry-splash.js']);
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
  if (url.hostname !== location.hostname) return; // external services: browser handles them

  // Never touch ranged requests or requests that carry credentials in a header.
  if (request.headers.has('Range') || request.headers.has('Authorization')) return;

  // Navigations: never stored per URL; offline fallback is the single shell.
  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up')) return;
    event.respondWith(navigationHandler(event, request, url));
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
    if (isCacheable(response)) safePut(event, cacheName, request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function navigationHandler(event, request, url) {
  try {
    const response = await fetch(request);
    // Refresh the single shell from the home page only; never store any other navigation.
    if (url.pathname === '/' && !url.search && response.status === 200 && !response.redirected && isCacheable(response)) {
      safePut(event, STATIC_CACHE, '/', response.clone());
    }
    return response;
  } catch {
    const shell = await safeMatch(STATIC_CACHE, '/');
    if (shell) return shell;
    const offlinePage = await safeMatch(STATIC_CACHE, OFFLINE_URL);
    if (offlinePage) return offlinePage;
    return new Response('Offline', { status: 503 });
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
