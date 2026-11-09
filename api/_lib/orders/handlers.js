/**
 * HTTP layer for /api/orders/*. Each api/orders/<name>.js file is a one-liner that
 * exports endpoint('<name>'). Tests call the same function with injected deps.
 *
 * Order of checks, always: method -> feature flag (404, before ANY I/O) -> Clerk auth (401)
 * -> admin allowlist (403, fail closed) -> logic.
 */
import { requireClerkAuth } from '../verifyClerk.js';
import { computeQuote, getPricingSettings, PRINT_PAGE_COUNT } from '../../../src/lib/printOrder/pricing.js';
import { createVendorClient } from '../bookpod/client.js';
import { createCreemPayment } from './payment/creem.js';
import { createMorningPayment } from './payment/morning.js';
import { createSummitPayment } from './payment/summit.js';
import { createSupabaseStore } from './store.js';
import {
  OrderError,
  adminAction,
  adminOrderView,
  createOrder,
  confirmReturnedPayment,
  isUuid,
  orderView,
  pricingToOrderError,
  sanitize,
} from './service.js';

export const isEnabled = (env) => env?.PRINT_ORDER_ENABLED === 'true';

export function adminIds(env) {
  return String(env?.PRINT_ADMIN_CLERK_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Printed books are paid through the SUMIT hosted payment page (Elad, 9.11.2026: no Grow, Summit).
 * PRINT_PAYMENT_PROVIDER=morning|creem are explicit escape hatches; default is summit.
 */
export function createPrintPayment(env = process.env) {
  const p = env.PRINT_PAYMENT_PROVIDER;
  if (p === 'creem') return createCreemPayment({ env });
  if (p === 'morning') return createMorningPayment({ env });
  return createSummitPayment({ env });
}

/** Build production deps lazily; only reached once the flag is on. */
export async function defaultDeps(env = process.env) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase service role not configured');
  return {
    env,
    auth: requireClerkAuth,
    store: createSupabaseStore(createClient(url, key, { auth: { persistSession: false } })),
    payment: createPrintPayment(env),
    vendor: createVendorClient({ env }),
  };
}

function send(res, status, body) {
  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
const fail = (res, status, code, message_he, extra = {}) =>
  send(res, status, { error: { code, message_he, ...extra } });

function queryOf(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    return Object.fromEntries(new URL(req.url, 'http://local').searchParams);
  } catch {
    return {};
  }
}
function bodyOf(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

const ownedBook = async (store, bookId, userId) => {
  if (typeof bookId !== 'string' || !bookId || bookId.length > 64) {
    throw new OrderError('invalid_book', 400, 'נא לבחור ספר');
  }
  const book = await store.getBook(bookId);
  if (!book || book.ownerId !== userId) throw new OrderError('book_not_found', 404, 'הספר לא נמצא');
  return book;
};

/* name -> {method, auth, admin, run(req,res,ctx)} */
const ENDPOINTS = {
  quote: {
    method: 'GET',
    async run(req, res, { deps, userId }) {
      const q = queryOf(req);
      const book = await ownedBook(deps.store, q.bookId, userId);
      let quote;
      try {
        quote = computeQuote(
          { presetId: book.printSize || 'square-220', pageCount: PRINT_PAGE_COUNT, qty: Number(q.qty), method: q.method },
          { env: deps.env },
        );
      } catch (e) {
        throw pricingToOrderError(e);
      }
      return send(res, 200, quote);
    },
  },
  create: {
    method: 'POST',
    async run(req, res, { deps, userId }) {
      const body = bodyOf(req);
      if (!body || typeof body !== 'object') throw new OrderError('invalid_body', 400, 'בקשה לא תקינה');
      const out = await createOrder(deps, { userId, body });
      return send(res, 200, out);
    },
  },
  mine: {
    method: 'GET',
    async run(req, res, { deps, userId }) {
      const rows = await deps.store.listByUser(userId);
      return send(res, 200, { orders: rows.map(orderView) });
    },
  },
  get: {
    method: 'GET',
    async run(req, res, { deps, userId }) {
      const { id, paymentId } = queryOf(req);
      let row = isUuid(id) ? await deps.store.getOrder(id) : null;
      // Someone else's order is indistinguishable from a missing one.
      if (!row || row.user_id !== userId) throw new OrderError('not_found', 404, 'ההזמנה לא נמצאה');
      // Back from the hosted payment page: the browser brings a payment id, which is only a hint.
      // The provider is asked directly; nothing moves unless it proves this order was paid in full.
      if (paymentId && row.status === 'awaiting_payment') {
        row = (await confirmReturnedPayment(deps, row, paymentId)) || row;
      }
      return send(res, 200, orderView(row));
    },
  },
  'admin-list': {
    method: 'GET',
    admin: true,
    async run(req, res, { deps }) {
      const { status } = queryOf(req);
      const rows = await deps.store.listAll({ status: status || undefined });
      const alerts = await deps.store.listAlerts(50);
      return send(res, 200, {
        orders: rows.map(adminOrderView),
        alerts: alerts.map((a) => ({
          id: a.id,
          orderId: a.order_id,
          type: a.type,
          createdAt: a.created_at,
          data: JSON.parse(sanitize(JSON.stringify(a.data ?? {}))),
        })),
      });
    },
  },
  'admin-action': {
    method: 'POST',
    admin: true,
    async run(req, res, { deps, userId }) {
      const body = bodyOf(req);
      if (!body || typeof body !== 'object') throw new OrderError('invalid_body', 400, 'בקשה לא תקינה');
      const out = await adminAction(deps, { id: body.id, action: body.action, note: body.note, actor: userId });
      return send(res, 200, { order: adminOrderView(out.order) });
    },
  },
};

async function configHandler(req, res, overrides) {
  const env = overrides?.env || process.env;
  if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed', 'שיטה לא נתמכת');
  if (!isEnabled(env)) return send(res, 200, { enabled: false });
  const s = getPricingSettings(env);
  return send(res, 200, {
    enabled: true,
    pickup: { enabled: s.pickupEnabled, label_he: 'איסוף עצמי' },
    maxQty: s.maxQty,
  });
}

/**
 * @param {string} name config | quote | create | mine | get | admin-list | admin-action
 * @returns {(req,res,overrides?)=>Promise<void>}
 */
export function endpoint(name) {
  if (name === 'config') return configHandler;
  const def = ENDPOINTS[name];
  if (!def) throw new Error(`unknown orders endpoint ${name}`);

  return async function handler(req, res, overrides) {
    const env = overrides?.env || process.env;
    try {
      if (req.method !== def.method) return fail(res, 405, 'method_not_allowed', 'שיטה לא נתמכת');
      // Flag first: when off nothing else runs (no auth, no DB, no network).
      if (!isEnabled(env)) return fail(res, 404, 'disabled', 'השירות אינו פעיל');

      const deps = overrides?.store ? { env, ...overrides } : { ...(await defaultDeps(env)), ...overrides, env };
      const auth = await deps.auth(req);
      const userId = auth?.ok ? auth.payload?.sub : null;
      if (!userId) return fail(res, 401, 'unauthorized', 'נדרשת התחברות');

      if (def.admin && !adminIds(env).includes(userId)) {
        return fail(res, 403, 'forbidden', 'אין הרשאה');
      }
      return await def.run(req, res, { deps, userId });
    } catch (e) {
      if (e instanceof OrderError) {
        return fail(res, e.status, e.code, e.message_he, e.fields ? { fields: e.fields } : {});
      }
      console.error('[orders]', name, sanitize(e?.message));
      return fail(res, 500, 'server_error', 'משהו השתבש, נא לנסות שוב');
    }
  };
}
