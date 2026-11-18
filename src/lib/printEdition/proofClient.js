import { getApiAuthHeaders } from '@/lib/apiAuth';
import { readEditionArt } from './assets';
import { checkedChunks, chooseProofFile, printArchive, saveProofStream } from './proofDownload';

const endpoint = '/api/books/print-proof';
const chunkSize = 1024 * 1024;
const maxImage = 15 * chunkSize;
const maxBook = 160 * chunkSize;

async function request(url, signal, payload) {
  const headers = await getApiAuthHeaders();
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
  return async function renderProof(bookId, manifest, sources, signal, expectedRevision = 0) {
    const current = new Set(sources);
    for (const key of cache.keys()) if (!current.has(key)) cache.delete(key);
    const assets = [];
    let total = 0;
    for (const source of sources) {
      signal.throwIfAborted();
      let asset = cache.get(source);
      if (!asset) {
        const blob = await readEditionArt(source, signal);
        if (!blob.size || blob.size > maxImage || total + blob.size > maxBook) throw new Error('Artwork too large');
        const sha256 = await digestBlob(blob);
        asset = { blob, sha256, size: blob.size };
        signal.throwIfAborted();
        if (source.startsWith('data:')) cache.set(source, asset);
      }
      total += asset.size;
      if (total > maxBook) throw new Error('Book too large');
      assets.push(asset);
    }
    const post = async body => (await request(endpoint, signal, { ...body, bookId })).json();
    const descriptors = assets.map(({ sha256, size }) => ({ sha256, size }));
    const { job, session, missing } = await whenAvailable(() => post({ op: 'prepare', manifest, expectedRevision, assets: descriptors }), signal);
    await workers(missing, 2, async index => {
      const { blob } = assets[index - 1];
      for (let start = 0, part = 0; start < blob.size; start += chunkSize, part++) {
        signal.throwIfAborted();
        const data = await base64(blob.slice(start, start + chunkSize));
        await post({ op: 'upload', job, session, index, part, data });
      }
    });
    assets.length = 0;
    const { proof } = await whenAvailable(() => post({ op: 'render', job, session }), signal);
    const fileUrl = file => endpoint + '?' + new URLSearchParams({ bookId, job, session, file });
    const urls = new Map();
    const revoke = () => { for (const url of urls.values()) URL.revokeObjectURL(url); };
    try {
      const files = [proof.coverFile, proof.insideFile, ...proof.pages.map(page => page.file)].filter(Boolean);
      // Fail together: a late image fetch cannot leak a blob URL after cleanup.
      const results = await Promise.allSettled(Array.from({ length: Math.min(4, files.length) }, async () => {
        while (files.length) {
          const file = files.shift();
          const response = await request(fileUrl(file), signal);
          const blob = await response.blob();
          signal.throwIfAborted();
          if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Invalid proof page');
          urls.set(file, URL.createObjectURL(blob));
        }
      }));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
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
      revoke();
      throw error;
    }
  };
}
