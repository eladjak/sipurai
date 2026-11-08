/**
 * Print-fulfilment vendor client (server only; this path and name must never
 * reach any response body, src/ or public/).
 *
 * Interface: submitOrder(order, files) -> {ref}; getStatus(ref) -> {status, trackingUrl?}
 *
 * Gate: real calls happen ONLY when BOOKPOD_ENABLED === 'true' AND BOOKPOD_API_KEY is set.
 * Otherwise every method throws VendorError('vendor_disabled') BEFORE any network I/O.
 *
 * Outcome classification (drives the retry policy, see service.js):
 *   vendor_disabled / vendor_not_configured : definitely nothing was sent
 *   vendor_rejected                         : definite refusal (HTTP 4xx)
 *   vendor_timeout / vendor_unknown         : UNKNOWN outcome. Never auto-resubmitted.
 *
 * What research.txt documents (everything else is marked TODO(unverified)):
 *   - auth via two headers x-user-id + x-custom-token
 *   - a book is created with POST api/v1/books from two PDFs (content + cover)
 *   - an order is POSTed to api/v1/orders for an existing book, with address + delivery type
 *   - POST api/v1/orders/price exists and creates nothing
 */

export class VendorError extends Error {
  constructor(code, message, { unknownOutcome = false } = {}) {
    super(message || code);
    this.name = 'VendorError';
    this.code = code;
    this.unknownOutcome = unknownOutcome;
  }
}

const TIMEOUT_MS = 20000;

export function isVendorEnabled(env = process.env) {
  return env.BOOKPOD_ENABLED === 'true' && Boolean(env.BOOKPOD_API_KEY);
}

export function createVendorClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  function assertEnabled() {
    if (!isVendorEnabled(env)) throw new VendorError('vendor_disabled', 'fulfillment is switched off');
    // The base URL is configuration, not a constant: no verified production base for this account yet.
    if (!env.BOOKPOD_API_BASE || !env.BOOKPOD_USER_ID) {
      throw new VendorError('vendor_not_configured', 'fulfillment is not configured');
    }
  }

  async function call(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetchImpl(`${env.BOOKPOD_API_BASE.replace(/\/+$/, '')}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': env.BOOKPOD_USER_ID,
          // research.txt: token sent in x-custom-token. The env var is named API_KEY by contract.
          'x-custom-token': env.BOOKPOD_API_KEY,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      // Timeout or network error AFTER the request may have been sent: outcome unknown.
      const timedOut = e?.name === 'AbortError';
      throw new VendorError(timedOut ? 'vendor_timeout' : 'vendor_unknown', e?.message, { unknownOutcome: true });
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.status >= 400 && res.status < 500) {
      throw new VendorError('vendor_rejected', `status ${res.status}`);
    }
    if (!res.ok) {
      // 5xx: the vendor may have partially processed it.
      throw new VendorError('vendor_unknown', `status ${res.status}`, { unknownOutcome: true });
    }
    return data;
  }

  return {
    async submitOrder(order, files) {
      assertEnabled();
      if (!files?.contentUrl || !files?.coverUrl) throw new VendorError('vendor_rejected', 'missing print files');

      // Step 1: create the book from the two PDFs.
      // TODO(unverified): docs describe two PDFs; whether they are multipart uploads or URLs, and the
      // field names below, are NOT confirmed against the account.
      const book = await call('POST', '/api/v1/books', {
        title: order.quote?.bookTitle || `order-${order.id}`,
        content_pdf_url: files.contentUrl,
        cover_pdf_url: files.coverUrl,
      });
      const bookId = book?.id ?? book?.book_id;
      if (!bookId) throw new VendorError('vendor_unknown', 'no book id in response', { unknownOutcome: true });

      // Step 2: place the order.
      // TODO(unverified): shipping type values, address field names, and whether an external
      // reference (used below to make a retry detectable) is supported.
      const created = await call('POST', '/api/v1/orders', {
        book_id: bookId,
        quantity: order.qty,
        shipping_type: order.method === 'pickup' ? 'factory_pickup' : 'home',
        address: order.address,
        external_reference: order.id,
      });
      const ref = created?.id ?? created?.order_id;
      if (!ref) throw new VendorError('vendor_unknown', 'no order id in response', { unknownOutcome: true });
      return { ref: String(ref) };
    },

    async getStatus(ref) {
      assertEnabled();
      // TODO(unverified): status/tracking endpoint is not documented in research.txt.
      const data = await call('GET', `/api/v1/orders/${encodeURIComponent(ref)}`);
      return { status: data?.status ?? 'unknown', trackingUrl: data?.tracking_url ?? null };
    },
  };
}
