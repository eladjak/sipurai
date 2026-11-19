import { createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sandbox } from '@vercel/sandbox';
import { CHUNK_BYTES, ProofError, SESSION_MS, currentSession, hash } from './printProofRequest.js';

const NAME_PREFIX = 'sipurai-proof-';
const ROOT = '/vercel/sandbox/print-proof';
const VENV = '/vercel/sandbox/print-proof-venv';
const PYTHON = `${VENV}/bin/python`;
const ENGINE = [
  'bootstrap.sh', 'proof_session.py', 'proof_job.py', 'layout.py', 'design.py', 'render.py', 'requirements.txt',
  'fonts/DavidLibre-Medium.ttf', 'fonts/Rubik.ttf', 'fonts/Fredoka.ttf',
];
const PACKAGE_NETWORK = { allow: ['archive.ubuntu.com', 'security.ubuntu.com', 'pypi.org', 'files.pythonhosted.org'] };
const SLOTS_PER_BUCKET = 3;
const OWNER_SLOT_CHOICES = 2;
const VM_TIMEOUT_MS = SESSION_MS - 60 * 1000;
const FILE_THRESHOLD_MS = 15 * 1000;
const RENDER_THRESHOLD_MS = 135 * 1000;
const SAFE_ERRORS = new Set(['proof_input', 'proof_busy', 'proof_not_found', 'proof_incomplete', 'proof_checksum', 'proof_limit',
  'proof_unavailable', 'proof_session_expired']);
const SAFE_FIT = /^(?:Page [0-9]{1,2} story text|title|creator|dedication|copyright|cover-title|cover-creator|back-blurb|back-about-author) does not fit its safe area at [0-9]{2} pt$/;

function identity({ env, userId, bookId }) {
  const namespace = env.VERCEL_DEPLOYMENT_ID || env.VERCEL_URL || env.VERCEL_ENV || 'local';
  const secret = env.PRINT_PROOF_SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new ProofError('proof_setup');
  const sign = input => createHmac('sha256', secret).update(JSON.stringify(input)).digest('hex');
  const binding = sign(['sipurai-print-proof-v1', namespace, userId, bookId]);
  const offset = parseInt(hash(userId).slice(0, 6), 16) % SLOTS_PER_BUCKET;
  return {
    binding,
    names: session => Array.from({ length: OWNER_SLOT_CHOICES }, (_, index) =>
      `${NAME_PREFIX}${session}-${(offset + index) % SLOTS_PER_BUCKET}`),
  };
}

function statusCode(error) {
  return error?.response?.status;
}

async function lookup(provider, name) {
  try {
    return await provider.get({ name, resume: false });
  } catch (error) {
    if (statusCode(error) === 404 || statusCode(error) === 410) return null;
    throw error;
  }
}

function isAvailable(sandbox, now, threshold = FILE_THRESHOLD_MS) {
  if (!sandbox || sandbox.persistent !== false) return false;
  try {
    return sandbox.status === 'running' && Number(sandbox.expiresAt) - now > threshold;
  } catch {
    // A stopped nonpersistent sandbox can have no current Session object.
    return false;
  }
}

async function slots(provider, id, session) {
  return Promise.all(id.names(session).map(async name => ({ name, sandbox: await lookup(provider, name) })));
}

async function acquire(provider, id, request, env, now) {
  const matching = entries => entries.filter(entry => entry.sandbox?.tags?.binding === id.binding);
  if (request.op !== 'prepare') {
    const entries = matching(await slots(provider, id, request.session));
    const sandbox = entries.find(entry => isAvailable(entry.sandbox, now))?.sandbox;
    if (!sandbox) throw new ProofError('proof_session_expired');
    return { sandbox, session: request.session };
  }

  const session = currentSession(now);
  const current = await slots(provider, id, session);
  const owned = matching(current);
  const active = owned.find(entry => isAvailable(entry.sandbox, now))?.sandbox;
  if (active) return { sandbox: active, session };
  for (const { sandbox } of owned) {
    try {
      if (sandbox.status === 'pending') throw new ProofError('proof_busy');
    } catch (error) {
      if (error instanceof ProofError) throw error;
    }
  }
  // A prepare retry just across the time boundary can still use this book's previous VM.
  const previousSession = String(Number(session) - 1);
  const previous = matching(await slots(provider, id, previousSession))
    .find(entry => isAvailable(entry.sandbox, now, RENDER_THRESHOLD_MS))?.sandbox;
  if (previous) return { sandbox: previous, session: previousSession };

  const snapshot = env.PRINT_PROOF_SANDBOX_SNAPSHOT_ID;
  const image = env.PRINT_PROOF_SANDBOX_IMAGE;
  const source = snapshot ? { source: { type: 'snapshot', snapshotId: snapshot } } : { image: image || 'vercel/sandbox/universal' };
  // The provider reserves each name atomically. Names share one project namespace
  // across deployments, and only the matching owner/book may use a claimed slot.
  for (const candidate of current) {
    if (candidate.sandbox) continue;
    const { name } = candidate;
    try {
      const sandbox = await provider.create({
        ...source, name, persistent: false, timeout: VM_TIMEOUT_MS, resources: { vcpus: 1 },
        tags: { binding: id.binding, service: 'sipurai-print-proof' },
        networkPolicy: snapshot || image ? 'deny-all' : PACKAGE_NETWORK,
      });
      return { sandbox, session };
    } catch (error) {
      if (statusCode(error) === 429) throw new ProofError('proof_limit');
      if (statusCode(error) !== 409) throw error;
      const occupant = await lookup(provider, name);
      if (!occupant) throw new ProofError('proof_busy');
      if (occupant.tags?.binding === id.binding) {
        if (isAvailable(occupant, now)) return { sandbox: occupant, session };
        throw new ProofError('proof_busy');
      }
    }
  }
  throw new ProofError('proof_limit');
}

async function isOffline(sandbox) {
  const file = await sandbox.readFileToBuffer({ path: `${ROOT}/offline` });
  return file?.toString('utf8') === 'ready\n';
}

async function bootstrap(sandbox, env, loadEngine) {
  if (await isOffline(sandbox)) return;
  const existing = await sandbox.readFileToBuffer({ path: `${ROOT}/packages-ready` });
  if (!existing) {
    const staged = `${ROOT}/engine-${randomBytes(16).toString('hex')}`;
    const files = await Promise.all(ENGINE.map(async file => ({
      path: `${staged}/${file}`, content: await loadEngine(file), mode: 0o600,
    })));
    try {
      await sandbox.writeFiles(files);
      const checkOnly = env.PRINT_PROOF_SANDBOX_IMAGE || env.PRINT_PROOF_SANDBOX_SNAPSHOT_ID;
      const result = await sandbox.runCommand({
        cmd: 'bash', args: [`${staged}/bootstrap.sh`, ROOT, VENV, checkOnly ? 'check' : 'install', staged],
        timeoutMs: 130 * 1000,
      });
      if (result.exitCode === 75) throw new ProofError('proof_busy');
      if (result.exitCode !== 0) throw new ProofError('proof_setup');
    } finally {
      await sandbox.runCommand('rm', ['-rf', '--', staged], { timeoutMs: 5000 }).catch(() => {});
    }
  }
  // No private material is allowed into this VM before the network transition.
  await sandbox.updateNetworkPolicy('deny-all');
  await sandbox.writeFiles([{ path: `${ROOT}/offline`, content: Buffer.from('ready\n'), mode: 0o600 }]);
}

async function worker(sandbox, op, job, args = [], timeoutMs = 15 * 1000) {
  const result = await sandbox.runCommand({
    cmd: PYTHON,
    args: ['-B', `${ROOT}/engine/proof_session.py`, op, ROOT, job, ...args],
    timeoutMs,
  });
  if (result.exitCode !== 0) throw new ProofError('proof_unavailable');
  const value = JSON.parse(await result.stdout());
  if (value.error) {
    const code = SAFE_ERRORS.has(value.error) ? value.error : 'proof_unavailable';
    const detail = code === 'proof_input' && typeof value.detail === 'string' && SAFE_FIT.test(value.detail) ? value.detail : undefined;
    throw new ProofError(code, detail);
  }
  return value;
}

async function withInput(sandbox, request, bytes, args) {
  const nonce = randomBytes(16).toString('hex');
  try {
    await sandbox.writeFiles([{ path: `${ROOT}/incoming/${nonce}`, content: bytes, mode: 0o600 }]);
    return await worker(sandbox, request.op, request.job, [...args, nonce]);
  } catch (error) {
    // A command that ran clears its own staging file. Also clear a completed
    // write if the first worker invocation could not start.
    await worker(sandbox, 'discard', request.job, [nonce]).catch(() => {});
    throw error;
  }
}

async function readProof(sandbox, job) {
  const root = `${ROOT}/jobs/${job}/output`;
  const metadata = await sandbox.readFileToBuffer({ path: `${root}/proof.json` });
  if (!metadata) throw new ProofError('proof_session_expired');
  if (metadata.length > 256 * 1024) throw new ProofError('proof_not_found');
  return { root, proof: JSON.parse(metadata.toString('utf8')) };
}

async function storedSpec(sandbox, job) {
  const spec = await sandbox.readFileToBuffer({ path: `${ROOT}/jobs/${job}/request.json` });
  if (!spec) throw new ProofError('proof_session_expired');
  if (spec.length > 256 * 1024) throw new ProofError('proof_not_found');
  return JSON.parse(spec.toString('utf8'));
}

export async function servePrintProof({
  request, userId, env = process.env, now = Date.now(), provider = Sandbox,
  loadEngine = file => readFile(join(process.cwd(), 'scripts', 'print_edition', file)),
}) {
  const id = identity({ userId, bookId: request.bookId, env });
  const { sandbox, session } = await acquire(provider, id, request, env, now);
  if (request.op === 'prepare') {
    await bootstrap(sandbox, env, loadEngine);
    const { missing } = await withInput(sandbox, request, request.content, []);
    return { session, job: request.job, missing };
  }
  if (!(await isOffline(sandbox))) throw new ProofError('proof_busy');
  if (request.op === 'upload') {
    const spec = await storedSpec(sandbox, request.job);
    const count = spec.assets[request.index - 1]?.size;
    if (!count || request.part * CHUNK_BYTES >= count
        || request.bytes.length !== Math.min(CHUNK_BYTES, count - request.part * CHUNK_BYTES)) throw new ProofError('proof_input');
    await withInput(sandbox, request, request.bytes, [String(request.index), String(request.part)]);
    return { ok: true };
  }
  if (request.op === 'render') {
    await worker(sandbox, 'render', request.job, [], RENDER_THRESHOLD_MS);
    // Fetch metadata as a file so owner text never passes through VM command logs.
    const { proof } = await readProof(sandbox, request.job);
    return { proof };
  }
  const { root, proof } = await readProof(sandbox, request.job);
  const allowedFiles = new Set([
    proof.coverFile, proof.insideFile, ...proof.pages.map(page => page.file), ...Object.keys(proof.pdfSha256),
  ]);
  if (!allowedFiles.has(request.file)) throw new ProofError('proof_not_found');
  if (request.file.endsWith('.pdf')) {
    const spec = await storedSpec(sandbox, request.job);
    if (spec.sourceFingerprint !== request.fingerprint) throw new ProofError('proof_conflict');
  }
  const stream = await sandbox.readFile({ path: `${root}/${request.file}` });
  if (!stream) throw new ProofError('proof_session_expired');
  return { file: request.file, stream, mediaType: request.file.endsWith('.pdf') ? 'application/pdf' : 'image/webp' };
}
