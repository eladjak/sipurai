import { pipeline } from 'node:stream/promises';
import { requireClerkAuth } from '../_lib/verifyClerk.js';
import { serviceClient } from '../_lib/consent.js';
import { ProofError, proofRequest } from '../_lib/printProofRequest.js';
import { servePrintProof } from '../_lib/printProofSandbox.js';
import { bindProofSource, createPrintProofStore, sourceFingerprint } from '../_lib/printProofSource.js';

const ORIGINS = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];

export default async function handler(req, res, overrides = {}) {
  const env = overrides.env || process.env;
  const origin = req.headers?.origin;
  if (ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, noarchive');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: { code: 'method_not_allowed' } });
  }

  try {
    const auth = await (overrides.auth || requireClerkAuth)(req);
    const userId = auth?.ok && auth.payload?.sub;
    if (!userId) throw new ProofError('unauthorized');
    if (env.PRINT_PROOF_DISABLED === 'true') throw new ProofError('proof_disabled');
    const now = overrides.now?.() ?? Date.now();
    let request = proofRequest(req, now);
    const withSource = request.op === 'prepare' || (request.op === 'read' && request.file.endsWith('.pdf'));
    const store = overrides.store || createPrintProofStore(await serviceClient(env));
    const book = await store.findBook(request.bookId, { withSource });
    if (!book || book.created_by !== userId) throw new ProofError('proof_not_found');
    if (withSource) {
      const fingerprint = await sourceFingerprint(store, request.bookId, book, request.expectedRevision);
      request = bindProofSource(request, fingerprint);
    }

    const options = { request, userId, env, now, provider: overrides.provider, loadEngine: overrides.loadEngine };
    const result = await (overrides.serve || servePrintProof)(options);
    if (request.op !== 'read') return res.status(200).json(result);
    res.setHeader('Content-Type', result.mediaType);
    if (result.mediaType === 'application/pdf') {
      res.setHeader('Content-Disposition', `attachment; filename="${result.file}"`);
    }
    // Streaming (without a buffered body or Content-Length) supports print-size PDFs.
    res.flushHeaders?.();
    await pipeline(result.stream, res);
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof ProofError) {
      if ([409, 429].includes(error.status)) res.setHeader('Retry-After', '3');
      return res.status(error.status).json(error.body);
    }
    const code = error?.response?.status;
    if (code === 410) {
      const expired = new ProofError('proof_session_expired');
      return res.status(expired.status).json(expired.body);
    }
    const unavailable = new ProofError('proof_unavailable');
    console.error('[print-proof] unavailable');
    return res.status(unavailable.status).json(unavailable.body);
  }
}
