// POST /api/account/delete  { confirm: 'delete-my-account' }
// Deletes the SIGNED-IN user's data, files and Clerk account. Who is decided only by the verified token.
import { requireClerkAuth } from '../_lib/verifyClerk.js';
import { DELETE_MESSAGES, accountDeleteEnabled, clerkDeleteUser, defaultDeletionDeps, deleteAccount } from '../_lib/accountDeletion.js';

const ORIGINS = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];

export default async function handler(req, res, overrides = {}) {
  const origin = req.headers?.origin;
  res.setHeader?.('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : ORIGINS[0]);
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' } });

  // Switched off by default (ACCOUNT_DELETE_ENABLED=true turns it on). Off means: no auth, no database, no network.
  const env = overrides.env || process.env;
  if (!accountDeleteEnabled(env)) {
    return res.status(503).json({ error: { code: 'disabled', message_he: DELETE_MESSAGES.disabled } });
  }

  const auth = await (overrides.auth || requireClerkAuth)(req);
  const userId = auth?.ok ? auth.payload?.sub : null;
  if (!userId) return res.status(401).json({ error: { code: 'unauthorized', message_he: 'נדרשת התחברות' } });

  if (req.body?.confirm !== 'delete-my-account') {
    return res.status(400).json({ error: { code: 'confirm_required', message_he: DELETE_MESSAGES.needConfirm } });
  }
  let deps = overrides;
  if (!deps.store || !deps.consentStore) {
    try {
      deps = { ...overrides, ...(await defaultDeletionDeps(env)) };
    } catch (e) {
      console.error('[account/delete] no database:', String(e?.message).slice(0, 120));
      return res.status(503).json({ error: { code: 'unavailable', message_he: DELETE_MESSAGES.failed } });
    }
  }
  const r = await deleteAccount({
    userId,
    store: deps.store,
    consentStore: deps.consentStore,
    clerkDelete: deps.clerkDelete || ((id) => clerkDeleteUser(id, { env, fetchImpl: overrides.fetchImpl })),
    env,
  });
  return res.status(r.http).json(r.body);
}
