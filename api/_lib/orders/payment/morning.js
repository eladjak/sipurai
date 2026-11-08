/**
 * Morning (Green Invoice) payment adapter for PRINTED-book orders.
 *
 * Interface (same as the other adapters):
 *   createCheckout(order)                       -> { url, ref }
 *   confirmPayment(order, { documentId })       -> normalized event | null   (null = not paid / not proven)
 *   verifyNotify({ query, headers, raw })       -> { orderId, documentId }   (throws PaymentError)
 *
 * Why there is no "verify the webhook body" step like Creem: Morning's payment-form
 * `notifyUrl` is a bare POST whose body is NOT documented and NOT signed. So the notify
 * is only a TRIGGER. Two independent checks stand between it and "paid":
 *   1. the notify URL carries a per-order HMAC token we minted (`?o=<orderId>&t=<hex>`),
 *      so a stranger cannot even point us at an order;
 *   2. we then ask Morning itself (authenticated API) for the receipt and require:
 *      type 400, status open/closed, currency ILS, remarks carry this order id, and the
 *      amount equals OUR stored total to the agora. The notify body's own numbers are never used.
 * Anything unproven fails closed (order stays awaiting_payment).
 *
 * Amounts: Morning takes UNITS (108 = 108.00 ILS), our DB stores AGOROT (10800).
 * agorotToUnits / unitsToAgorot are the only conversion points.
 *
 * Elad is osek patur: document type 400 (receipt), vatType 1 (exempt), never VAT lines.
 */
import crypto from 'node:crypto';
import { PaymentError } from './creem.js';

export { PaymentError };

export const RECEIPT_TYPE = 400;
const OK_STATUSES = new Set([0, 1, 2]); // open, closed, manually closed. 3/4 = cancelling / cancelled

export function morningApiBase(env = process.env) {
  if (env.MORNING_API_BASE) return env.MORNING_API_BASE.replace(/\/+$/, '');
  return env.MORNING_TEST_MODE === 'true'
    ? 'https://sandbox.d.greeninvoice.co.il/api/v1'
    : 'https://api.greeninvoice.co.il/api/v1';
}

export function morningTokenUrl(env = process.env) {
  if (env.MORNING_IDP_URL) return env.MORNING_IDP_URL;
  // TODO(unverified): the sandbox identity host is not documented; set MORNING_IDP_URL explicitly for the sandbox.
  return env.MORNING_TEST_MODE === 'true'
    ? 'https://sandbox.d.greeninvoice.co.il/idp/v1/oauth/token'
    : 'https://api.morning.co/idp/v1/oauth/token';
}

export function agorotToUnits(agorot) {
  if (!Number.isInteger(agorot) || agorot <= 0) throw new PaymentError('bad_amount');
  return Number((agorot / 100).toFixed(2));
}
export const unitsToAgorot = (units) => (typeof units === 'number' && Number.isFinite(units) ? Math.round(units * 100) : null);

/** Per-order token embedded in the notify URL. */
export function notifyToken(orderId, secret) {
  return crypto.createHmac('sha256', secret).update(`morning-notify:${orderId}`).digest('hex');
}
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  if (x.length === 0 || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

const SITE = 'https://sipurai.ai';

export function createMorningPayment({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let cached = null; // { token, exp }

  async function getToken() {
    if (cached && cached.exp > now()) return cached.token;
    const id = env.MORNING_API_KEY_ID;
    const secret = env.MORNING_API_KEY_SECRET;
    if (!id || !secret) throw new PaymentError('payment_not_configured');
    let res;
    try {
      res = await fetchImpl(morningTokenUrl(env), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
      });
    } catch (e) {
      throw new PaymentError('payment_unreachable', e.message);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.accessToken) throw new PaymentError('payment_auth_failed', `status ${res.status}`);
    cached = { token: data.accessToken, exp: now() + 50 * 60 * 1000 }; // token lives 1 hour
    return cached.token;
  }

  async function api(method, path, body) {
    const token = await getToken();
    let res;
    try {
      res = await fetchImpl(`${morningApiBase(env)}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      throw new PaymentError('payment_unreachable', e.message);
    }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function normalizeDocument(order, doc) {
    if (!doc || Number(doc.type) !== RECEIPT_TYPE) return null;
    if (!OK_STATUSES.has(Number(doc.status ?? 0))) return null;
    if (String(doc.currency || '').toUpperCase() !== 'ILS') return null;
    if (!String(doc.remarks || '').includes(order.id)) return null; // receipt must be for THIS order
    const agorot = unitsToAgorot(doc.amount);
    if (agorot === null) return null;
    return {
      eventId: `morning:${doc.id}`,
      type: 'payment.completed',
      orderId: order.id,
      paymentRef: String(doc.id),
      receiptNumber: doc.number ?? null,
      amountAgorot: agorot,
      currency: 'ILS',
    };
  }

  return {
    name: 'morning',

    async createCheckout(order) {
      const secret = env.MORNING_NOTIFY_SECRET;
      if (!secret) throw new PaymentError('payment_not_configured');
      const amount = agorotToUnits(order.total_agorot); // 10800 agorot -> 108 (never 10800)
      const title = 'ספר מודפס מסיפוראי';
      const q = `o=${encodeURIComponent(order.id)}&t=${notifyToken(order.id, secret)}`;
      const payload = {
        description: title,
        type: RECEIPT_TYPE,
        amount,
        currency: 'ILS',
        vatType: 1, // exempt (osek patur)
        lang: 'he',
        maxPayments: 1,
        client: { name: order.address?.fullName || 'לקוח סיפוראי', add: false },
        income: [{ description: title, quantity: 1, price: amount, currency: 'ILS', vatType: 1 }],
        remarks: `הזמנה ${order.id}`,
        successUrl: `${SITE}/orders?paid=1&order=${encodeURIComponent(order.id)}`,
        failureUrl: `${SITE}/orders?failed=1&order=${encodeURIComponent(order.id)}`,
        notifyUrl: `${SITE}/api/webhooks/morning?${q}`,
        custom: order.id,
      };
      const { ok, status, data } = await api('POST', '/payments/form', payload);
      if (!ok) throw new PaymentError('payment_rejected', `status ${status}`);
      if (data && data.success === false) {
        // e.g. no clearing plugin connected on the account
        throw new PaymentError('payment_rejected', `morning error ${data.errorCode ?? ''}`.trim());
      }
      const url = data?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) throw new PaymentError('payment_bad_response');
      // Morning returns no payment-request id; the order id is our reference until the receipt id is known.
      return { url, ref: `morning:${order.id}` };
    },

    /** Token check on the notify URL. Does NOT prove payment. */
    verifyNotify({ query = {}, headers = {}, raw = '' } = {}) {
      const secret = env.MORNING_NOTIFY_SECRET;
      if (!secret) throw new PaymentError('webhook_secret_missing');
      const orderId = query.o;
      if (typeof orderId !== 'string' || !safeEqualHex(String(query.t || ''), notifyToken(orderId, secret))) {
        throw new PaymentError('bad_signature');
      }
      // Optional second layer: if the account's webhook has a secret and the header is present, it must match.
      const sig = headers['x-webhook-signature'];
      if (sig && env.MORNING_WEBHOOK_SECRET) {
        const expected = crypto.createHmac('sha256', env.MORNING_WEBHOOK_SECRET).update(raw).digest('hex');
        if (!safeEqualHex(String(sig), expected)) throw new PaymentError('bad_signature');
      }
      let documentId = null;
      try {
        const b = raw ? JSON.parse(raw) : {};
        // Body shape is undocumented: accept the plausible spots, trust none of the numbers in it.
        const cand = b?.documentId || b?.document?.id || b?.document_id;
        if (typeof cand === 'string' && /^[0-9a-f-]{8,64}$/i.test(cand)) documentId = cand;
      } catch {
        /* a body we cannot read is fine: we look the receipt up ourselves */
      }
      return { orderId, documentId };
    },

    /**
     * Ask Morning whether this order has a valid paid receipt.
     * @returns normalized event, or null when nothing proves payment.
     * @throws PaymentError('payment_unreachable'|'payment_auth_failed') when we could not look (caller must retry later).
     */
    async confirmPayment(order, { documentId } = {}) {
      if (documentId) {
        const r = await api('GET', `/documents/${encodeURIComponent(documentId)}`);
        if (r.ok) {
          const evt = normalizeDocument(order, r.data);
          if (evt) return evt;
        }
      }
      // Fall back to a bounded look through recent receipts.
      const created = new Date(order.created_at || now());
      const from = new Date(created.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const s = await api('POST', '/documents/search', { page: 1, pageSize: 25, type: [RECEIPT_TYPE], fromDate: from, sort: 'creationDate' });
      if (!s.ok) throw new PaymentError('payment_unreachable', `search status ${s.status}`);
      for (const item of (s.data?.items || []).slice(0, 25)) {
        if (!item?.id) continue;
        const d = await api('GET', `/documents/${encodeURIComponent(item.id)}`);
        if (!d.ok) continue;
        const evt = normalizeDocument(order, d.data);
        if (evt) return evt;
      }
      return null;
    },
  };
}
