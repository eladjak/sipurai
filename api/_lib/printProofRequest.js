import { createHash } from 'node:crypto';

export const CHUNK_BYTES = 1024 * 1024;
export const SESSION_MS = 20 * 60 * 1000;
export const DIGEST = /^[a-f0-9]{64}$/;
const BOOK_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const SESSION = /^[0-9]{1,12}$/;
const ART_PATH = /^art\/image-[1-9][0-9]?$/;
const ART_FIELDS = ['coverArt', 'closingArt', 'dedicationArt', 'endpaperArt', 'characterSheet'];
const EDITION_FIELDS = new Set([
  'version', 'title', 'creator', 'blurb', 'aboutAuthor', 'dedication', 'copyright',
  ...ART_FIELDS, 'scenes', 'qrUrl', 'nikudStatus', 'widthMm', 'heightMm', 'bleedMm', 'gutterMm',
  'minPages', 'signatureMultiple', 'spineMm', 'binding', 'paper', 'insideCover', 'brightness',
  'coverNativePixels', 'closingNativePixels', 'requestedFinishing', 'storyFont', 'unsavedDraft',
]);
const SCENE_FIELDS = new Set(['layout', 'art', 'text', 'zones', 'anchor', 'panel', 'pointing', 'nativePixels', 'panelWidthsMm']);
const BODY_FIELDS = {
  prepare: ['op', 'bookId', 'manifest', 'assets'],
  upload: ['op', 'bookId', 'session', 'job', 'index', 'part', 'data'],
  render: ['op', 'bookId', 'session', 'job'],
};
const ARTIFACT = /^(?:page-(?:0[1-9]|[1-7][0-9]|80)\.webp|cover-(?:wrap|inside)\.webp|(?:interior|cover|cover-with-inside)\.pdf)$/;

const MESSAGES = {
  unauthorized: [401, 'נדרשת התחברות כדי לפתוח הגהת דפוס.'],
  proof_not_found: [404, 'ההגהה המבוקשת לא נמצאה.'],
  proof_disabled: [503, 'הגהת הדפוס אינה זמינה כרגע.'],
  proof_session_expired: [410, 'תוקף ההגהה פג. אפשר להפיק הגהה חדשה.'],
  proof_busy: [409, 'ההגהה כבר בתהליך. אפשר לנסות שוב בעוד רגע.'],
  proof_conflict: [409, 'הספר השתנה מאז שההגהה הופקה. יש לפתוח את הגרסה העדכנית.'],
  proof_incomplete: [409, 'חלק מהאיורים עוד לא עלו. יש לנסות שוב.'],
  proof_input: [422, 'אי אפשר להפיק הגהה מהפרטים האלה. כדאי לבדוק את הטקסט והאיורים.'],
  proof_checksum: [422, 'אחד האיורים לא הגיע במלואו. יש לנסות שוב.'],
  proof_limit: [429, 'הגעתם למכסת ההגהות הזמנית. אפשר לנסות שוב בהמשך.'],
  proof_setup: [503, 'מנוע ההגהה עדיין לא זמין. אפשר לנסות שוב בעוד רגע.'],
  proof_unavailable: [503, 'ההגהה אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.'],
};

export class ProofError extends Error {
  constructor(code, detail) {
    super(code);
    const [status, message_he] = MESSAGES[code] || MESSAGES.proof_unavailable;
    this.status = status;
    this.body = { error: { code, message_he, ...(detail ? { detail } : {}) } };
  }
}

export function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function fields(value, allowed) {
  return object(value) && Object.keys(value).every(key => allowed.has(key));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function currentSession(now) {
  return String(Math.floor(now / SESSION_MS));
}

export function requireSession(session, now) {
  if (typeof session !== 'string' || !SESSION.test(session)) throw new ProofError('proof_input');
  const current = currentSession(now);
  if (session !== current && session !== String(Number(current) - 1)) throw new ProofError('proof_session_expired');
  return session;
}

function preparedSpec({ manifest, assets, bookId }) {
  if (!fields(manifest, EDITION_FIELDS) || manifest.version !== 1
      || !Array.isArray(manifest.scenes) || !manifest.scenes.length || manifest.scenes.length > 76
      || !Array.isArray(assets) || !assets.length || assets.length > 81
      || Buffer.byteLength(JSON.stringify(manifest)) > 128 * 1024) throw new ProofError('proof_input');
  const referenced = new Set();
  for (const artField of ART_FIELDS) {
    const path = manifest[artField];
    if (path == null && artField !== 'coverArt' && artField !== 'closingArt') continue;
    if (typeof path !== 'string' || !ART_PATH.test(path)) throw new ProofError('proof_input');
    referenced.add(path);
  }
  for (const scene of manifest.scenes) {
    if (!fields(scene, SCENE_FIELDS) || typeof scene.art !== 'string' || !ART_PATH.test(scene.art)) {
      throw new ProofError('proof_input');
    }
    referenced.add(scene.art);
  }
  if (manifest.qrUrl && manifest.qrUrl !== `https://www.sipurai.ai/b/print/${bookId}`
      && manifest.qrUrl !== `https://sipurai.ai/b/print/${bookId}`) throw new ProofError('proof_input');
  const papers = { standard: 'white-110gsm', 'chrome-matte-130': 'chrome-matte-130', 'chrome-matte-170': 'chrome-matte-170' };
  const actualPaper = manifest.paper ?? 'white-110gsm';
  if (!Object.values(papers).includes(actualPaper) || (manifest.binding ?? 'soft-matte') !== 'soft-matte') throw new ProofError('proof_input');
  if (manifest.requestedFinishing !== undefined) {
    const finishing = manifest.requestedFinishing;
    if (!fields(finishing, new Set(['cover', 'paper'])) || Object.keys(finishing).length !== 2
        || !['softcover', 'hardcover'].includes(finishing.cover)
        || !Object.hasOwn(papers, finishing.paper) || papers[finishing.paper] !== actualPaper) throw new ProofError('proof_input');
  }
  if (Object.hasOwn(manifest, 'storyFont') && !['david-libre', 'rubik'].includes(manifest.storyFont)) {
    throw new ProofError('proof_input');
  }
  if (Object.hasOwn(manifest, 'unsavedDraft') && typeof manifest.unsavedDraft !== 'boolean') {
    throw new ProofError('proof_input');
  }
  if (referenced.size !== assets.length) throw new ProofError('proof_input');
  let totalBytes = 0;
  const sizes = new Map();
  const normalized = assets.map((item, index) => {
    if (!object(item) || Object.keys(item).length !== 2 || typeof item.sha256 !== 'string' || !DIGEST.test(item.sha256)
        || !Number.isInteger(item.size) || item.size < 1 || item.size > 15 * CHUNK_BYTES
        || !referenced.has(`art/image-${index + 1}`)
        || (sizes.has(item.sha256) && sizes.get(item.sha256) !== item.size)) throw new ProofError('proof_input');
    totalBytes += item.size;
    sizes.set(item.sha256, item.size);
    return { sha256: item.sha256, size: item.size };
  });
  if (totalBytes > 160 * CHUNK_BYTES) throw new ProofError('proof_input');
  return { manifest: canonical(manifest), assets: normalized };
}

function uploadBytes(data) {
  if (typeof data !== 'string' || data.length > 4 * Math.ceil(CHUNK_BYTES / 3) || data.length % 4) {
    throw new ProofError('proof_input');
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > CHUNK_BYTES || buffer.toString('base64') !== data) throw new ProofError('proof_input');
  return buffer;
}

export function proofRequest(req, now) {
  const data = req.method === 'GET' ? req.query : req.body;
  const bookId = data?.bookId;
  if (typeof bookId !== 'string' || !BOOK_ID.test(bookId)) throw new ProofError('proof_input');
  if (req.method === 'GET') {
    if (!object(data) || typeof data.file !== 'string' || !ARTIFACT.test(data.file)) throw new ProofError('proof_not_found');
  } else {
    if (!object(data) || typeof data.op !== 'string' || !Object.hasOwn(BODY_FIELDS, data.op)) throw new ProofError('proof_input');
    const fields = BODY_FIELDS[data.op];
    const hasRevision = data.op === 'prepare' && Object.hasOwn(data, 'expectedRevision');
    if (Object.keys(data).length !== fields.length + Number(hasRevision)
        || !fields.every(key => Object.hasOwn(data, key))) throw new ProofError('proof_input');
    if (data.op === 'prepare') {
      const { expectedRevision } = data;
      if (hasRevision && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) throw new ProofError('proof_input');
      return { op: 'prepare', bookId, expectedRevision, spec: preparedSpec(data) };
    }
  }
  if (typeof data.job !== 'string' || !DIGEST.test(data.job)) throw new ProofError('proof_not_found');
  const session = requireSession(data.session, now);
  if (req.method === 'GET') return { op: 'read', bookId, session, job: data.job, file: data.file };
  if (data.op === 'render') return { op: 'render', bookId, session, job: data.job };
  if (!Number.isInteger(data.index) || data.index < 1 || data.index > 81
      || !Number.isInteger(data.part) || data.part < 0 || data.part >= 15) throw new ProofError('proof_input');
  return { op: 'upload', bookId, session, job: data.job, index: data.index, part: data.part, bytes: uploadBytes(data.data) };
}
