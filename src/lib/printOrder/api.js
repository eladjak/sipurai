/**
 * Thin fetch wrapper for the printed-book order API (/api/orders/*).
 *
 * Auth: uses the same Clerk token accessor as the AI routes (src/lib/apiAuth.js).
 * Errors: every failure becomes a PrintOrderApiError with a Hebrew message that
 * is safe to show to a person.
 *
 * @typedef {{ key: 'book'|'shipping', label_he: string, amountAgorot: number }} QuoteLine
 * @typedef {{ currency: 'ILS', presetId: string, qty: number, method: 'ship'|'pickup',
 *   lines: QuoteLine[], totalAgorot: number, vatIncluded: boolean }} Quote
 * @typedef {{ fullName: string, phone: string, city: string, street: string, houseNumber: string,
 *   apartment?: string, zip?: string, notes?: string }} Address
 * @typedef {{ id: string, status: string, bookId: string, bookTitle?: string, presetId?: string,
 *   qty: number, method: 'ship'|'pickup', totalAgorot: number, createdAt: string, paidAt?: string,
 *   trackingUrl?: string, statusLabel_he?: string }} OrderView
 * @typedef {{ enabled: boolean, pickup?: { enabled: boolean, label_he: string }, maxQty?: number }} PrintConfig
 */
import { getApiAuthHeaders } from '@/lib/apiAuth';

export class PrintOrderApiError extends Error {
  /** @param {{ code?: string, message_he?: string, status?: number }} info */
  constructor({ code = 'unknown', message_he, status = 0 } = {}) {
    super(message_he || 'משהו השתבש. נסו שוב בעוד רגע.');
    this.name = 'PrintOrderApiError';
    this.code = code;
    this.status = status;
    this.message_he = this.message;
  }
}

const NETWORK_MESSAGE = 'אין חיבור לאינטרנט כרגע. בדקו את החיבור ונסו שוב.';

async function request(path, { method = 'GET', body, auth = true } = {}) {
  /** @type {Record<string,string>} */
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) Object.assign(headers, await getApiAuthHeaders());

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new PrintOrderApiError({ code: 'network', message_he: NETWORK_MESSAGE });
  }

  /** @type {any} */
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = data && data.error ? data.error : {};
    throw new PrintOrderApiError({
      code: err.code || (res.status === 403 ? 'forbidden' : res.status === 401 ? 'unauthorized' : 'http_' + res.status),
      message_he: err.message_he,
      status: res.status,
    });
  }
  if (data === null) {
    throw new PrintOrderApiError({ code: 'bad_response', status: res.status });
  }
  return data;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const printOrderApi = {
  /** @returns {Promise<PrintConfig>} */
  getConfig: () => request('/api/orders/config', { auth: false }),
  /** @returns {Promise<Quote>} */
  getQuote: ({ bookId, qty, method }) => request('/api/orders/quote' + qs({ bookId, qty, method })),
  /** @returns {Promise<{orderId: string, status: string, checkoutUrl: string}>} */
  createOrder: ({ bookId, qty, method, address, idempotencyKey }) =>
    request('/api/orders/create', {
      method: 'POST',
      body: { bookId, qty, method, address: address ?? null, idempotencyKey },
    }),
  /** @returns {Promise<{orders: OrderView[]}>} */
  getMyOrders: () => request('/api/orders/mine'),
  /** @returns {Promise<OrderView>} */
  getOrder: (id) => request('/api/orders/get' + qs({ id })),
  /** @returns {Promise<{orders: any[], alerts: any[]}>} */
  adminList: (status) => request('/api/orders/admin-list' + qs({ status })),
  /** @returns {Promise<any>} */
  adminAction: ({ id, action, note }) =>
    request('/api/orders/admin-action', { method: 'POST', body: { id, action, note } }),
};

export default printOrderApi;
