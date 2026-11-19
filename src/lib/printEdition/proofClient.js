import { getApiAuthHeaders } from '@/lib/apiAuth';
import { readEditionArt } from './assets';
import { checkedChunks, chooseProofFile, printArchive, saveProofStream } from './proofDownload';

const endpoint = '/api/books/print-proof';
const chunkSize = 1024 * 1024;
const maxImage = 15 * chunkSize;
const maxBook = 160 * chunkSize;

async function request(url, signal, payload) {
  const headers = await bounded(signal, 15_000, () => getApiAuthHeaders());
  signal.throwIfAborted();
  /** @type {RequestInit} */
  const init = { headers, signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error' };
  if (payload) {
    init.method = 'POST';
    init.headers = { ...headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(payload);
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const code = detail?.error?.code;
    throw Object.assign(new Error(code === 'proof_conflict' ? 'conflict' : 'Proof request failed'), { status: response.status, code, detail: detail?.error?.detail });
  }
  return response;
}

function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unreadable illustration'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function workers(values, count, action) {
  let cursor = 0;
  async function next() {
    while (cursor < values.length) {
      const index = cursor++;
      await action(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(values.length, count) }, next));
}

function pause(ms, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// Abort transport and settle even when an SDK call (such as auth) ignores abort.
function bounded(parent, ms, action) {
  parent.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(parent.reason);
  const timeout = setTimeout(() => controller.abort(Object.assign(new Error('Proof request timed out'), {
    code: 'proof_timeout',
  })), ms);
  parent.addEventListener('abort', cancel, { once: true });
  const signal = controller.signal;
  const aborted = new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  return Promise.race([Promise.resolve().then(() => {
    signal.throwIfAborted();
    return action(signal);
  }), aborted]).finally(() => {
    clearTimeout(timeout);
    parent.removeEventListener('abort', cancel);
  });
}

async function whenAvailable(operation, signal) {
  const deadline = Date.now() + 120000;
  for (;;) {
    try { return await operation(); }
    catch (error) {
      if (!['proof_busy', 'proof_limit'].includes(error.code) || Date.now() >= deadline) throw error;
      await pause(error.status === 429 ? 6000 : 2500, signal);
    }
  }
}

async function digestBlob(blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

export function createProofClient() {
  // Scope cached private bytes to this open owner/book. Keep only the current artwork.
  const cache = new Map();
  return async function renderProof(bookId, manifest, sources, parent, expectedRevision = 0, onStage = () => {}) {
    parent.throwIfAborted();
    const controller = new AbortController();
    const cancel = () => controller.abort(parent.reason);
    parent.addEventListener('abort', cancel, { once: true });
    try {
      return await compose(bookId, manifest, sources, controller, expectedRevision, onStage);
    } finally {
      controller.abort();
      parent.removeEventListener('abort', cancel);
    }
  };

  async function compose(bookId, manifest, sources, controller, expectedRevision, onStage) {
    const { signal } = controller;
    const current = new Set(sources);
    for (const key of cache.keys()) if (!current.has(key)) cache.delete(key);
    onStage('artwork');
    const assets = [];
    let total = 0;
    for (const source of sources) {
      signal.throwIfAborted();
      let asset = cache.get(source);
      if (!asset) {
        asset = await bounded(signal, 45_000, async requestSignal => {
          const blob = await readEditionArt(source, requestSignal);
          requestSignal.throwIfAborted();
          if (!blob.size || blob.size > maxImage || total + blob.size > maxBook) throw new Error('Artwork too large');
          return { blob, sha256: await digestBlob(blob), size: blob.size };
        }).catch(error => {
          if (signal.aborted || error.code === 'proof_timeout') throw error;
          throw Object.assign(new Error('Illustration unavailable', { cause: error }), { code: 'proof_artwork' });
        });
        signal.throwIfAborted();
        if (source.startsWith('data:')) cache.set(source, asset);
      }
      total += asset.size;
      if (total > maxBook) throw new Error('Book too large');
      assets.push(asset);
    }
    const post = (body, timeout) => bounded(signal, timeout,
      async requestSignal => (await request(endpoint, requestSignal, { ...body, bookId })).json());
    const descriptors = assets.map(({ sha256, size }) => ({ sha256, size }));
    onStage('prepare');
    const { job, session, missing } = await whenAvailable(() => post({ op: 'prepare', manifest, expectedRevision, assets: descriptors }, 305_000), signal);
    if (missing.length) onStage('upload');
    await workers(missing, 2, async index => {
      const { blob } = assets[index - 1];
      for (let start = 0, part = 0; start < blob.size; start += chunkSize, part++) {
        signal.throwIfAborted();
        const data = await bounded(signal, 15_000, () => base64(blob.slice(start, start + chunkSize)));
        await post({ op: 'upload', job, session, index, part, data }, 45_000);
      }
    });
    assets.length = 0;
    onStage('render');
    const { proof } = await whenAvailable(() => post({ op: 'render', job, session }, 155_000), signal);
    onStage('preview');
    const fileUrl = file => endpoint + '?' + new URLSearchParams({ bookId, job, session, file });
    const urls = new Map();
    const revoke = () => { for (const url of urls.values()) URL.revokeObjectURL(url); };
    try {
      const files = [proof.coverFile, proof.insideFile, ...proof.pages.map(page => page.file)].filter(Boolean);
      // Each worker checks the attempt signal before creating an object URL.
      await workers(files, 4, async file => {
        const blob = await bounded(signal, 45_000, async requestSignal => {
          const response = await request(fileUrl(file), requestSignal);
          return response.blob();
        });
        signal.throwIfAborted();
        if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Invalid proof page');
        urls.set(file, URL.createObjectURL(blob));
      });
      const pdfs = { ...proof.pdfs };
      if (proof.insideFile && proof.pdfSha256['cover-with-inside.pdf']) pdfs.inside = 'cover-with-inside.pdf';
      async function* open(file, signal) {
        const response = await request(fileUrl(file), signal);
        yield* checkedChunks(response, proof.pdfSha256[file], signal);
      }
      async function verifyArt(signal) {
        for (const [index, source] of sources.entries()) {
          signal.throwIfAborted();
          if (source.startsWith('data:')) continue;
          const blob = await readEditionArt(source, signal);
          if (blob.size !== descriptors[index].size || await digestBlob(blob) !== descriptors[index].sha256) throw new Error('conflict');
        }
      }
      return {
        ...proof, pdfs, unsavedDraft: Boolean(manifest.unsavedDraft), nikudStatus: manifest.nikudStatus, coverUrl: urls.get(proof.coverFile), insideUrl: urls.get(proof.insideFile),
        pages: proof.pages.map(page => ({ ...page, url: urls.get(page.file) })), revoke,
        download: async (key, revision, final, verifyHandoff, downloadSignal) => {
          const archive = key === 'handoff';
          const file = pdfs[key];
          if (!archive && !['cover.pdf', 'interior.pdf', 'cover-with-inside.pdf'].includes(file)) throw new Error('Unknown PDF');
          const filename = archive ? 'sipurai-print-files-r' + revision + '.zip' : 'sipurai-' + (final ? 'proof-' : 'draft-') + file;
          const handle = await chooseProofFile(filename);
          const checkRevision = () => verifyHandoff({ requireApproval: archive });
          await checkRevision();
          await verifyArt(downloadSignal);
          const receipt = {
            version: 1, bookId, editionRevision: revision, proofId: job,
            pdfSha256: { 'interior.pdf': proof.pdfSha256['interior.pdf'], 'cover.pdf': proof.pdfSha256['cover.pdf'] },
            trimMm: [proof.trimWidthMm, proof.trimHeightMm], bleedMm: proof.bleedMm, spineMm: proof.spineMm,
            binding: manifest.binding, paper: manifest.paper, requestedFinishing: manifest.requestedFinishing,
            nikudStatus: manifest.nikudStatus, physicalProofRequired: true,
          };
          const files = archive
            ? printArchive(['interior.pdf', 'cover.pdf'], file => open(file, downloadSignal), receipt, downloadSignal)
            : open(file, downloadSignal);
          await saveProofStream(filename, files, handle, checkRevision, downloadSignal);
        },
      };
    } catch (error) {
      controller.abort();
      revoke();
      throw error;
    }
  }
}
