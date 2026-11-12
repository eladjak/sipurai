// Shared request shell for the two book routes: CORS, method, Clerk auth, service-role store.
import { requireClerkAuth } from './verifyClerk.js';
import { serviceClient } from './consent.js';
import { BOOK_MESSAGES, createSupabaseBookStore } from './bookControls.js';

const ORIGINS = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];

export function bookRoute(action) {
  return async function handler(req, res, overrides = {}) {
    const origin = req.headers?.origin;
    res.setHeader?.('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : ORIGINS[0]);
    res.setHeader?.('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });

    const auth = await (overrides.auth || requireClerkAuth)(req);
    const userId = auth?.ok ? auth.payload?.sub : null;
    if (!userId) return res.status(401).json({ error: { code: 'unauthorized', message_he: BOOK_MESSAGES.unauthorized } });

    let store = overrides.store;
    if (!store) {
      try {
        store = createSupabaseBookStore(await serviceClient(overrides.env || process.env));
      } catch (e) {
        console.error('[books] no database:', String(e?.message).slice(0, 120));
        return res.status(503).json({ error: { code: 'unavailable', message_he: BOOK_MESSAGES.unavailable } });
      }
    }
    const r = await action({ userId, bookId: req.body?.bookId, store });
    return res.status(r.http).json(r.body);
  };
}
