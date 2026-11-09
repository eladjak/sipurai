// POST /api/books/reserve  { bookKey }  -> take one slot from this month's free books.
import { requireClerkAuth } from '../_lib/verifyClerk.js';
import { defaultQuotaStore, reserveBook, MESSAGES } from '../_lib/quota.js';

const ORIGINS = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];

export default async function handler(req, res, overrides = {}) {
  const origin = req.headers?.origin;
  res.setHeader?.('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Book-Key');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });

  const env = overrides.env || process.env;
  const auth = await (overrides.auth || requireClerkAuth)(req);
  const userId = auth?.ok ? auth.payload?.sub : null;
  if (!userId) return res.status(401).json({ error: { code: 'unauthorized', message_he: 'נדרשת התחברות' } });

  const bookKey = String(req.body?.bookKey || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(bookKey)) {
    return res.status(400).json({ error: { code: 'bad_book_key', message_he: MESSAGES.needKey } });
  }
  try {
    const store = overrides.store || (await defaultQuotaStore(env));
    const r = await reserveBook({ store, userId, bookKey, env, now: overrides.now, fetchImpl: overrides.fetchImpl });
    return res.status(r.http).json(r.body);
  } catch (e) {
    console.error('[books/reserve] failed closed:', String(e?.message).slice(0, 120));
    return res.status(503).json({ error: { code: 'quota_unavailable', message_he: MESSAGES.unavailable } });
  }
}
