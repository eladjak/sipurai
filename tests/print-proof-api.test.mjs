import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { promisify } from 'node:util';
import test from 'node:test';
import { execFile } from 'node:child_process';
import handler from '../api/books/print-proof.js';
import { CHUNK_BYTES, SESSION_MS, currentSession, proofRequest } from '../api/_lib/printProofRequest.js';
import { createPrintProofStore } from '../api/_lib/printProofSource.js';

const run = promisify(execFile);
const bookId = 'book-owner-only';
const requestId = 'a'.repeat(64);
const owner = { ok: true, payload: { sub: 'user_private' } };
const store = { findBook: async id => id === bookId ? { created_by: 'user_private' } : null,
  sourcePages: async () => [] };
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGOM8KxhoCVgoqnpoxaMWjBqwagFoxaMWjBqwagFoxaMWjBqARUBAA5DAV3hvTViAAAAAElFTkSuQmCC', 'base64');
const edition = {
  version: 1, title: 'סיפור ליד החלון', creator: 'אור', blurb: 'שני חברים יוצאים למסע',
  coverArt: 'art/image-1', closingArt: 'art/image-1', insideCover: false, nikudStatus: 'pending',
  scenes: [{ layout: 'single', art: 'art/image-1', zones: ['bottom'], text: ['לַיְלָה טוֹב'], pointing: ['pending'] }],
};
const now = Date.parse('2026-11-18T10:10:00Z');
const session = currentSession(now);
const env = { VERCEL_DEPLOYMENT_ID: 'offline-fake-sdk', PRINT_PROOF_SESSION_SECRET: 'test-only-secret' };

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

function prepare(art = image, manifest = edition) {
  return { op: 'prepare', bookId, manifest, assets: [{ sha256: digest(art), size: art.length }] };
}

function capturedResponse() {
  const response = new PassThrough();
  const chunks = [];
  response.on('data', chunk => chunks.push(chunk));
  response.on('end', () => { response.bytes = Buffer.concat(chunks); });
  return Object.assign(response, {
    headers: new Map(),
    status(code) { this.code = code; return this; },
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    json(value) { this.body = value; return this; },
  });
}

async function call(body, overrides = {}, method = 'POST') {
  const state = capturedResponse();
  await handler({ method, headers: {}, ...(method === 'GET' ? { query: body } : { body }) }, state,
    { env, auth: async () => owner, store, now: () => now, ...overrides });
  return state;
}

async function harness(t, options) {
  const root = await mkdtemp(join(tmpdir(), 'sipurai-vm-fake-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = new Map();
  const phases = [];
  const provider = {
    async get({ name, resume }) {
      assert.equal(resume, false);
      const entry = state.get(name);
      if (!entry) throw Object.assign(new Error('missing name'), { response: { status: 404 } });
      return entry;
    },
    async create(settings) {
      if (state.has(settings.name)) throw Object.assign(new Error('duplicate name'), { response: { status: 409 } });
      assert.equal(settings.persistent, false);
      assert.equal(settings.resources.vcpus, 1);
      assert.equal(settings.timeout, SESSION_MS - 60 * 1000);
      assert.match(settings.tags.binding, /^[a-f0-9]{64}$/);
      phases.push('create');
      state.set(settings.name, { persistent: false, status: 'pending', tags: settings.tags });
      const home = join(root, settings.name);
      await mkdir(home);
      const locate = path => {
        assert.ok(path.startsWith('/vercel/sandbox/'));
        return home + path.slice('/vercel/sandbox'.length);
      };
      const vm = {
        network: settings.networkPolicy, persistent: false, status: 'running',
        tags: settings.tags, expiresAt: new Date(now + SESSION_MS),
        async readFileToBuffer({ path }) {
          return readFile(locate(path)).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
        },
        async readFile({ path }) { return createReadStream(locate(path)); },
        async writeFiles(files) {
          for (const file of files) {
            if (file.path.includes('/incoming/')) {
              assert.equal(this.network, 'deny-all', 'private bytes may only enter an offline VM');
              phases.push('private-write');
            }
            const local = locate(file.path);
            await mkdir(dirname(local), { recursive: true });
            await writeFile(local, file.content, { mode: file.mode });
          }
        },
        async runCommand(command, args) {
          const { cmd, args: argv, timeoutMs } = typeof command === 'string'
            ? { cmd: command, args, timeoutMs: 5000 } : command;
          if (options.setupFailure && cmd === 'bash') return { exitCode: 5 };
          if (options.quick && cmd.includes('/bin/python')) return { exitCode: 0, stdout: async () => '{"missing":[1]}' };
          if (cmd === 'bash') {
            const pythonHome = dirname(dirname(options.python));
            await symlink(pythonHome, locate('/vercel/sandbox/print-proof-venv')).catch(error => {
              if (error.code !== 'EEXIST') throw error;
            });
          }
          assert.ok(cmd === 'bash' || cmd === 'rm' || cmd === '/vercel/sandbox/print-proof-venv/bin/python');
          const localCommand = cmd.startsWith('/') ? locate(cmd) : cmd;
          const localArgs = argv.map(arg => arg.startsWith('/vercel/sandbox/') ? locate(arg) : arg);
          try {
            const result = await run(localCommand, localArgs, { timeout: timeoutMs });
            return { exitCode: 0, stdout: async () => result.stdout };
          } catch (error) {
            return { exitCode: error.code, stdout: async () => error.stdout };
          }
        },
        async updateNetworkPolicy(policy) {
          phases.push(policy);
          this.network = policy;
        },
      };
      if (options.quick) {
        const marker = locate('/vercel/sandbox/print-proof/offline');
        await mkdir(dirname(marker), { recursive: true });
        await writeFile(marker, 'ready\n');
        vm.network = 'deny-all';
      }
      state.set(settings.name, vm);
      return vm;
    },
  };
  return { provider, phases, state };
}

test('proof API rejects unauthenticated, non-owner, disabled, unknown paths, expired sessions and invalid manifests before provider use', async () => {
  const serve = () => assert.fail('Invalid requests must never reach a Sandbox');
  assert.equal((await call(prepare(), { auth: async () => ({ ok: false }), serve })).code, 401);
  assert.equal((await call(prepare(), { auth: async () => ({ ok: true, payload: { sub: 'stranger' } }), serve })).code, 404);
  assert.equal((await call(prepare(), { env: { PRINT_PROOF_DISABLED: 'true' }, serve })).code, 503);
  assert.equal((await call(prepare(image, { ...edition, iccProfile: '/etc/passwd' }), { serve })).code, 422);
  assert.equal((await call(prepare(image, { ...edition, storyFont: 'https://example.invalid/font.ttf' }), { serve })).code, 422);
  assert.equal((await call(prepare(image, { ...edition, unsavedDraft: 'true' }), { serve })).code, 422);
  assert.equal((await call(prepare(image, { ...edition, closingArt: 'art/../image-1' }), { serve })).code, 422);
  const mismatch = await call({ ...prepare(), expectedRevision: 4 }, { serve });
  assert.equal(mismatch.code, 409);
  assert.equal(mismatch.body.error.code, 'proof_conflict');
  assert.equal((await call({ bookId, session, job: requestId, file: '../edition.json' }, { serve }, 'GET')).code, 404);
  assert.equal((await call({ bookId, session: String(Number(session) - 2), job: requestId, file: 'cover.pdf' }, { serve }, 'GET')).code, 410);
  assert.equal((await call({ op: 'upload', bookId, session, job: requestId, index: 1, part: -1, data: 'AAAA' }, { serve })).code, 422);
  assert.equal((await call({ op: 'upload', bookId, session, job: requestId, index: 1, part: 0, data: 'AAA_' }, { serve })).code, 422);
});

test('artifact response streams more than 4.5 MiB and prevents storage and indexing', async t => {
  const content = Buffer.alloc(6 * CHUNK_BYTES, 0x41);
  const { Readable } = await import('node:stream');
  const server = createServer((req, res) => {
    Object.assign(res, {
      status(code) { this.statusCode = code; return this; },
      json(value) { this.end(JSON.stringify(value)); return this; },
    });
    req.query = { bookId, session, job: requestId, file: 'interior.pdf' };
    return handler(req, res, {
      env, auth: async () => owner, store, now: () => now,
      serve: async () => ({ mediaType: 'application/pdf', file: 'interior.pdf',
        stream: Readable.from([content.subarray(0, CHUNK_BYTES), content.subarray(CHUNK_BYTES)]) }),
    });
  });
  const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${port}`, { headers: { Authorization: 'Bearer test' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="interior.pdf"');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, noarchive');
  assert.equal(response.headers.get('transfer-encoding'), 'chunked');
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(content));
});

test('Supabase source query preserves ordered duplicate rows and refuses truncated results', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const rows = [
    { id: 'page-one', page_number: 1, text_content: 'First', image_url: '/original' },
    { id: 'page-two', page_number: 1, text_content: 'Second', image_url: '/second' },
  ];
  let pageCount = rows.length;
  const db = createClient('https://fixture.invalid', 'test-only-key', {
    auth: { persistSession: false },
    global: { fetch: async (request, init) => {
      const url = new URL(request);
      if (url.pathname === '/rest/v1/books') {
        assert.equal(url.searchParams.get('id'), 'eq.book-owner-only');
        assert.match(url.searchParams.get('select'), /print_revision:print_edition->revision/);
        return Response.json([{ id: bookId, created_by: 'user_private', print_revision: 4 }]);
      }
      assert.equal(url.pathname, '/rest/v1/pages');
      assert.equal(url.searchParams.get('book_id'), 'eq.book-owner-only');
      assert.equal(url.searchParams.get('order'), 'page_number.asc,id.asc');
      assert.match(new Headers(init.headers).get('Prefer'), /count=exact/);
      return Response.json(rows, { headers: { 'Content-Range': `0-1/${pageCount}` } });
    } },
  });
  const sources = createPrintProofStore(db);
  assert.equal((await sources.findBook(bookId, { withSource: true })).print_revision, 4);
  assert.deepEqual(await sources.sourcePages(bookId), rows);
  pageCount += 1;
  await assert.rejects(sources.sourcePages(bookId), { message: 'proof_unavailable' });
});

test('engine setup failure returns a safe code and uploads no private data', async t => {
  const { provider, phases } = await harness(t, { setupFailure: true });
  const response = await call(prepare(), { provider });
  assert.equal(response.code, 503);
  assert.equal(response.body.error.code, 'proof_setup');
  assert.deepEqual(phases, ['create']);
});

test('concurrent owners cannot expand the fixed project-wide slots or access another slot', async t => {
  const { provider, state } = await harness(t, { quick: true });
  const options = userId => ({
    provider, auth: async () => ({ ok: true, payload: { sub: userId } }),
    store: { findBook: async () => ({ created_by: userId }), sourcePages: async () => [] },
  });
  const owners = Array.from({ length: 12 }, (_, index) => `test-owner-${index}`);
  const attempts = await Promise.all(owners.map(user => call(prepare(), options(user))));
  assert.equal(state.size, 3);
  assert.equal(attempts.filter(response => response.code === 200).length, 3);
  assert.ok(attempts.every(response => [200, 429].includes(response.code)));
  const winner = attempts.findIndex(result => result.code === 200);
  const loser = attempts.findIndex(result => result.code === 429);
  const { job } = attempts[winner].body;
  assert.equal((await call({ op: 'render', bookId, job, session }, options(owners[loser]))).code, 410);
  assert.equal((await call(prepare(), options(owners[winner]))).code, 200);
  assert.equal(state.size, 3);
});

test('multipart API verifies checksums, deduplicates revisions and renders actual worker files', {
  skip: !process.env.PRINT_TEST_PYTHON,
}, async t => {
  const { provider, phases, state } = await harness(t, { python: process.env.PRINT_TEST_PYTHON });
  // PNG accepts trailing bytes after its IEND chunk. This forces an upload across the 1 MiB boundary.
  const large = Buffer.concat([image, Buffer.alloc(CHUNK_BYTES, 3)]);
  const chromeEdition = { ...edition, paper: 'chrome-matte-130', requestedFinishing: { cover: 'softcover', paper: 'chrome-matte-130' } };
  const book = { created_by: 'user_private', print_revision: 4, title: 'Original title',
    cover_image: '/cover-original', language: 'hebrew', print_size: 'square-220', total_pages: 24 };
  const pages = [
    { id: 'page-a', page_number: 1, image_url: '/image-original', text_content: 'First copy' },
    { id: 'page-b', page_number: 1, image_url: '/second', text_content: 'Duplicate page number' },
  ];
  const options = { provider, env: { ...env, PRINT_PROOF_SANDBOX_IMAGE: 'test-local-verified-image' },
    store: { findBook: async () => book, sourcePages: async () => pages } };
  const opened = await call({ ...prepare(large, chromeEdition), expectedRevision: 4 }, options);
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const job = opened.body.job;
  assert.deepEqual(opened.body, { job, session, missing: [1] });
  const upload = (part, payload) => call({ op: 'upload', bookId, job, session, index: 1, part,
    data: payload.toString('base64') }, options);
  const render = () => call({ op: 'render', bookId, job, session }, options);
  assert.equal((await render()).body.error.code, 'proof_incomplete');
  assert.equal((await upload(0, large.subarray(0, 16))).body.error.code, 'proof_input');
  assert.equal((await upload(0, Buffer.alloc(CHUNK_BYTES))).code, 200);
  assert.equal((await upload(1, large.subarray(CHUNK_BYTES))).body.error.code, 'proof_checksum');
  assert.equal((await upload(1, large.subarray(CHUNK_BYTES))).code, 200);
  assert.equal((await upload(0, large.subarray(0, CHUNK_BYTES))).code, 200);
  assert.equal((await upload(1, large.subarray(CHUNK_BYTES))).code, 200);
  const result = await render();
  assert.equal(result.code, 200, JSON.stringify(result.body));
  assert.equal(result.body.proof.pages.length, 24);
  assert.equal(result.body.proof.paper, 'chrome-matte-130');
  assert.equal(result.body.proof.spineMm, 1.5);
  assert.equal(result.body.proof.pages[3].storyIndex, 0);
  assert.equal(result.body.proof.insideFile, null);
  assert.deepEqual((await render()).body, result.body);
  assert.deepEqual((await call(prepare(large, chromeEdition), options)).body, { job, session, missing: [] });
  const revised = await call(prepare(large, { ...chromeEdition, title: 'סיפור חדש' }), options);
  assert.equal(revised.code, 200);
  assert.notEqual(revised.body.job, job);
  assert.deepEqual(revised.body.missing, []);
  assert.equal(state.size, 1);
  assert.equal(phases[1], 'deny-all');
  assert.equal((await call({ bookId, job, session, file: 'cover-inside.webp' }, options, 'GET')).code, 404);
  const file = 'interior.pdf';
  const readPdf = () => call({ bookId, job, session, file }, options, 'GET');
  assert.equal(digest((await readPdf()).bytes), result.body.proof.pdfSha256[file]);
  for (const [source, key] of [[pages[1], 'text_content'], [pages[0], 'image_url'], [book, 'print_revision']]) {
    const prior = source[key];
    source[key] = typeof prior === 'string' ? 'modified' : prior + 1;
    const stale = await readPdf();
    assert.equal(stale.code, 409);
    assert.equal(stale.body.error.code, 'proof_conflict');
    assert.equal(stale.bytes, undefined);
    source[key] = prior;
  }
  pages[1].text_content = 'A revised duplicate';
  const newSource = await call({ ...prepare(large, chromeEdition), expectedRevision: 4 }, options);
  assert.notEqual(newSource.body.job, job);
  assert.deepEqual(newSource.body.missing, []);
  const raster = await call({ bookId, job, session, file: 'page-04.webp' }, options, 'GET');
  assert.equal(raster.bytes.subarray(0, 4).toString(), 'RIFF', 'stale proof raster remains usable by owner');
  const vm = [...state.values()][0];
  vm.expiresAt = new Date(now);
  assert.equal((await render()).code, 410);
});

test('proof request preserves supported stocks and rejects mismatches or ambiguous legacy stock', () => {
  for (const [choice, paper] of [['standard', 'white-110gsm'], ['chrome-matte-130', 'chrome-matte-130'], ['chrome-matte-170', 'chrome-matte-170']]) {
    const manifest = { ...edition, paper, requestedFinishing: { cover: 'softcover', paper: choice } };
    const result = proofRequest({ method: 'POST', body: prepare(image, manifest) }, now);
    assert.equal(result.spec.manifest.paper, paper);
    assert.equal(result.spec.manifest.requestedFinishing.paper, choice);
  }
  for (const manifest of [
    { ...edition, paper: 'white-110gsm', requestedFinishing: { cover: 'softcover', paper: 'chrome-matte-130' } },
    { ...edition, paper: 'premium', requestedFinishing: { cover: 'softcover', paper: 'premium' } },
    { ...edition, paper: null },
    { ...edition, binding: null },
    { ...edition, requestedFinishing: { cover: 'softcover', paper: ['standard'] } },
  ]) assert.throws(() => proofRequest({ method: 'POST', body: prepare(image, manifest) }, now), /proof_input/);
});

test('legacy proof request with omitted paper and binding is accepted unchanged', () => {
  const result = proofRequest({ method: 'POST', body: prepare() }, now);
  assert.equal(Object.hasOwn(result.spec.manifest, 'paper'), false);
  assert.equal(Object.hasOwn(result.spec.manifest, 'binding'), false);
});

test('prepare rejects malformed stock and binding before sandbox use', async () => {
  let called = false;
  const provider = { async create() { called = true; throw new Error('unexpected'); } };
  for (const manifest of [
    { ...edition, paper: null },
    { ...edition, binding: null },
    { ...edition, requestedFinishing: { cover: 'softcover', paper: ['standard'] } },
  ]) {
    const response = await call(prepare(image, manifest), { provider });
    assert.equal(response.code, 422);
    assert.equal(response.body.error.code, 'proof_input');
  }
  assert.equal(called, false);
});
