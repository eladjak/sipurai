/**
 * e2e-server.mjs - the server the Playwright suite runs against.
 *
 * It serves the production build (dist/) the way vercel.json does (every unknown path falls back
 * to index.html) AND mounts the real serverless handlers from api/ under /api/*, so the suite can
 * prove things like "the consent route answers 401 without a login" against the actual code
 * instead of a mock. No Vercel CLI, no network, no secrets: handlers see an empty environment
 * unless the caller provides one.
 *
 * Usage: bun run build && node scripts/e2e-server.mjs   (PORT defaults to 4173)
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const API = path.join(ROOT, 'api');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

async function exists(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Minimal Vercel-style (req, res) shim: res.status().json(), res.setHeader(), res.end(), req.body, req.query. */
function decorate(req, res, url, rawBody) {
  req.query = Object.fromEntries(url.searchParams);
  const ct = String(req.headers['content-type'] || '');
  if (rawBody.length && ct.includes('application/json')) {
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      req.body = undefined;
    }
  } else {
    req.body = rawBody.length ? rawBody.toString('utf8') : undefined;
  }
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (data) => {
    res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
    return res;
  };
}

async function handleApi(req, res, url) {
  // /api/privacy/consent -> api/privacy/consent.js ; refuse anything that climbs out of api/
  const rel = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const file = path.resolve(API, `${rel}.js`);
  if (!file.startsWith(API + path.sep) || rel.startsWith('_lib') || !(await exists(file))) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: { code: 'not_found' } }));
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  decorate(req, res, url, Buffer.concat(chunks));
  try {
    const mod = await import(pathToFileURL(file).href);
    await mod.default(req, res);
  } catch (e) {
    console.error('[e2e-server] handler threw:', rel, String(e?.message).slice(0, 160));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { code: 'handler_threw' } }));
    }
  }
}

async function handleStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  let file = path.resolve(DIST, '.' + rel);
  if (!file.startsWith(DIST + path.sep) && file !== DIST) {
    res.statusCode = 403;
    return res.end('forbidden');
  }
  if (!(await exists(file))) {
    // vercel.json: { "source": "/(.*)", "destination": "/index.html" }
    file = path.join(DIST, 'index.html');
  }
  const body = await readFile(file);
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await handleStatic(req, res, url);
  } catch (e) {
    console.error('[e2e-server] error:', String(e?.message).slice(0, 160));
    if (!res.headersSent) res.statusCode = 500;
    res.end('server error');
  }
});

if (!(await exists(path.join(DIST, 'index.html')))) {
  console.error('dist/index.html is missing. Run "bun run build" first.');
  process.exit(1);
}
server.listen(PORT, () => console.log(`e2e server on http://localhost:${PORT}`));
