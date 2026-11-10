/**
 * Print-fulfilment vendor client (server only; this path and name must never
 * reach any response body, src/ or public/).
 *
 * Implements the vendor's OFFICIAL API (Oct-2026 docs: Create Book v5.1, Create Order v1.2,
 * Calculate Order Price v1.1, Shipment Tracking v1.1). Headers: x-user-id + x-custom-token.
 *
 * Interface (unchanged for service.js):
 *   submitOrder(order, files) -> {ref}      files = {content, cover}: PDF bytes built by our own server code (never URLs)
 *   getStatus(ref)            -> {status, trackingUrl}
 *   quote(order, bookId)      -> {totalAgorot, ...}   read-only price (POST /orders/price)
 *
 * Flow of submitOrder, in the documented order:
 *   1 POST /books/upload-url   -> signed GCS upload URLs
 *   2 PUT  each PDF to its signed URL (Content-Type: application/pdf, NO vendor headers)
 *   3 POST /books              -> metadata + gs:// URIs of the uploaded PDFs
 *   4 POST /orders/price       -> must match OUR expected cost within a margin, else refuse (fail closed)
 *   5 POST /orders             -> reference_num1 = our order id (the vendor rejects a repeat with 1502)
 *
 * Gate: real calls happen ONLY when BOOKPOD_ENABLED === 'true' AND a token is set.
 * Token env name: BOOKPOD_API_TOKEN (same as the Zehut / Israel Machar stores and the store script);
 * BOOKPOD_API_KEY is accepted as a legacy fallback. Otherwise every method throws
 * VendorError('vendor_disabled') BEFORE any network I/O.
 *
 * Outcome classification (drives service.js):
 *   NOTHING WAS ORDERED (safe to retry after a human looks):
 *     vendor_disabled, vendor_not_configured, vendor_rejected (4xx), vendor_token_expired,
 *     vendor_auth_failed, vendor_upload_failed, vendor_prestep_failed, vendor_price_mismatch
 *   UNKNOWN / ORDER MAY EXIST (never auto-resubmitted):
 *     vendor_timeout, vendor_unknown, vendor_duplicate_reference, vendor_created_with_errors
 * Only step 5 can create an order, so only step 5 can produce an unknown outcome.
 */
import crypto from 'node:crypto';
import { expectedVendorTotalAgorot, priceMarginAgorot, maxOrderAgorot } from './expected.js';

export class VendorError extends Error {
  constructor(code, message, { unknownOutcome = false } = {}) {
    super(message || code);
    this.name = 'VendorError';
    this.code = code;
    this.unknownOutcome = unknownOutcome;
  }
}

/** Codes after which the vendor definitely did NOT create an order. */
export const SAFE_VENDOR_CODES = new Set([
  'vendor_disabled',
  'vendor_not_configured',
  'vendor_rejected',
  'vendor_token_expired',
  'vendor_auth_failed',
  'vendor_upload_failed',
  'vendor_prestep_failed',
  'vendor_price_mismatch',
]);

export const DEFAULT_API_BASE = 'https://cloud-function-bookpod-festjdz7ga-ey.a.run.app';
// The partner token is only ever sent to this origin. A different BOOKPOD_API_BASE is refused, not honoured.
const PINNED_ORIGIN = DEFAULT_API_BASE;
const UPLOAD_HOST = 'storage.googleapis.com';
export const MAX_INTERIOR_BYTES = 250 * 1024 * 1024; // measured 123-155 MB for 24 pages
export const MAX_COVER_BYTES = 60 * 1024 * 1024; // measured 10 MB

/** Error text for logs/state: never the URL (signed query strings) or raw transport messages. */
const safeNetErr = (e) => `${e?.name || 'Error'}${e?.cause?.code ? `:${e.cause.code}` : e?.code ? `:${e.code}` : ''}`;
const API = '/api/v1';
const TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 170000;
const BREAKER_MS = 10 * 60 * 1000;
// Create Order "Common Errors" (v1.2): only these, with success:false, prove the order was NOT created.
const ORDER_REFUSAL_CODES = new Set([1100, 1110, 1111, 1200, 1501, 1505, 1506, 1507, 1508, 1509, 1512]);

// Documented enum values (Create Book, section 7 and Appendix A). Proof book #33377 used exactly these.
const BOOK_SPEC = Object.freeze({
  printcolor: 'color',
  sheettype: 'wood-free-white-110',
  laminationtype: 'matt',
  finishtype: 'soft',
  readingdirection: 'right', // "right" (right-to-left)
  bleed: true, // our PDFs already include the 3.2 mm bleed
});
const TRIM_CM = Object.freeze({
  'square-220': [22, 22],
  'square-200': [20, 20],
  'portrait-165x235': [16.5, 23.5],
});

export const vendorToken = (env = process.env) => env.BOOKPOD_API_TOKEN || env.BOOKPOD_API_KEY || '';

export function isVendorEnabled(env = process.env) {
  return env.BOOKPOD_ENABLED === 'true' && Boolean(vendorToken(env));
}

const digits = (s) => String(s ?? '').replace(/\D/g, '');

/**
 * Documented shippingDetails (Create Order, "Required Fields"). Pure.
 * email: the vendor requires one. We deliberately send OUR contact address, not the customer's:
 * the customer must never receive mail from the print partner.
 */
export function buildShippingDetails(order, env = process.env) {
  const a = order?.address || {};
  const email = env.BOOKPOD_CONTACT_EMAIL;
  if (!email) throw new VendorError('vendor_not_configured', 'contact email is not configured');
  if (!order?.id) throw new VendorError('vendor_rejected', 'order id missing');
  const base = {
    name: String(a.fullName || '').slice(0, 80),
    phoneNumber: digits(a.phone),
    email,
    reference_num1: order.id,
  };
  if (!base.name || !base.phoneNumber) throw new VendorError('vendor_rejected', 'recipient name/phone missing');

  if (order.method === 'pickup') {
    // 3 - Factory self-pickup
    return { shippingMethod: 3, ...base, ...(a.notes ? { notes: String(a.notes).slice(0, 200) } : {}) };
  }
  // 2 - Home delivery. shippingCompanyId omitted => "Local shipments: assigned automatically".
  const house = digits(a.houseNumber); // docs: "House number (only numeric, no special characters like /)"
  if (!a.city || !a.street || !house) throw new VendorError('vendor_rejected', 'address incomplete');
  if (!a.zip) throw new VendorError('vendor_rejected', 'zipCode missing'); // docs: zipCode (string) is required
  const suffix = String(a.houseNumber || '').replace(/[0-9]/g, '').trim();
  const notes = [a.notes, suffix ? `מספר בית: ${a.houseNumber}` : ''].filter(Boolean).join(' | ').slice(0, 200);
  return {
    shippingMethod: 2,
    ...base,
    city: a.city,
    street: a.street,
    house,
    ...(a.apartment ? { apartment: String(a.apartment) } : {}),
    zipCode: String(a.zip),
    ...(notes ? { notes } : {}),
  };
}

const slug = (s) => String(s || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'book';

/** gs:// URI of an uploaded object, derived from the signed upload URL the vendor returned. */
export function gsUriFromUploadUrl(uploadUrl, fileName) {
  // TODO(docs ambiguous): Create Book step 3 says contentUrl/coverUrl are "the link you obtained in the previous
  // interface", while the upload-url response lists only signed URLs and file names. The documented example
  // is gs://<bucket>/<file name>; we take <bucket> from the signed URL path (/upload/storage/v1/b/<bucket>/o).
  const m = /\/b\/([^/]+)\/o(?:\?|\/|$)/.exec(String(uploadUrl || ''));
  return m && fileName ? `gs://${m[1]}/${fileName}` : null;
}

export function createVendorClient({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let breakerUntil = 0; // after an auth failure no further calls for BREAKER_MS (no retry storm)
  let breakerCode = null;

  async function tripBreaker(code) {
    breakerUntil = now() + BREAKER_MS;
    breakerCode = code;
  }

  function assertEnabled() {
    if (!isVendorEnabled(env)) throw new VendorError('vendor_disabled', 'fulfillment is switched off');
    if (!env.BOOKPOD_USER_ID) throw new VendorError('vendor_not_configured', 'fulfillment is not configured');
    if (env.BOOKPOD_API_BASE) {
      let origin = '';
      try { origin = new URL(env.BOOKPOD_API_BASE).origin; } catch { /* falls through */ }
      if (origin !== PINNED_ORIGIN) throw new VendorError('vendor_not_configured', 'BOOKPOD_API_BASE is not the pinned partner host');
    }
    if (now() < breakerUntil) {
      throw new VendorError(breakerCode, 'authentication with the print partner is failing; call skipped');
    }
  }
  const base = () => PINNED_ORIGIN;

  /** stage 'pre' = nothing can have been ordered yet; 'order' = POST /orders (outcome unknown on doubt). */
  async function call(method, path, body, { stage = 'pre' } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetchImpl(`${base()}${API}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': env.BOOKPOD_USER_ID,
          'x-custom-token': vendorToken(env),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
        redirect: 'error', // credentials must never follow a redirect to another host; a redirect is a failure
      });
    } catch (e) {
      const timedOut = e?.name === 'AbortError';
      if (stage === 'order') {
        throw new VendorError(timedOut ? 'vendor_timeout' : 'vendor_unknown', timedOut ? 'timeout' : safeNetErr(e), { unknownOutcome: true });
      }
      throw new VendorError('vendor_prestep_failed', `${path}: ${timedOut ? 'timeout' : safeNetErr(e)}`);
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const status = res.status;
    // At the order stage only a DOCUMENTED, specific refusal proves that no order exists. Anything else (a gateway
    // 408/429/4xx, an unexpected body, a 401 without the documented body) is an unknown outcome: the request may
    // have been processed. Earlier stages create nothing, so for them any failure is safe.
    const documented = data && typeof data === 'object' && data.success === false && ORDER_REFUSAL_CODES.has(Number(data.code));
    const documentedAuth = data && typeof data === 'object' && data.error === 'Unauthorized';
    if (status === 401 || status === 403) {
      // Docs (Shipment Tracking, Common Errors): "401 Token expired" / "401 Invalid token or user ID" /
      // "403 The token is not enabled for the API".
      if (stage === 'order' && !documentedAuth && status === 401) {
        throw new VendorError('vendor_unknown', `status ${status} (undocumented body)`, { unknownOutcome: true });
      }
      const text = JSON.stringify(data || {});
      const code = status === 401 && /expired/i.test(text) ? 'vendor_token_expired' : 'vendor_auth_failed';
      await tripBreaker(code);
      throw new VendorError(code, `status ${status}`);
    }
    if (status >= 400 && status < 500) {
      const first = data?.errors?.[0];
      if (stage === 'order' && (first?.code === 1502 || data?.code === 1502)) {
        // 1502 = "reference_num1 already exists": the order is already at the vendor.
        throw new VendorError('vendor_duplicate_reference', 'reference already exists', { unknownOutcome: true });
      }
      if (stage === 'order' && !documented) {
        throw new VendorError('vendor_unknown', `status ${status} (not a documented refusal)`, { unknownOutcome: true });
      }
      const detail = first ? `${first.code}: ${first.message}` : data?.code ? `${data.code}: ${data.message}` : data?.error || '';
      throw new VendorError('vendor_rejected', `status ${status} ${detail}`.trim());
    }
    if (status >= 500) {
      if (stage === 'order') throw new VendorError('vendor_unknown', `status ${status}`, { unknownOutcome: true });
      throw new VendorError('vendor_prestep_failed', `${path}: status ${status}`);
    }
    return { status, data };
  }

  /**
   * Print files are BYTES produced by our own server code (printFiles.js). A URL is never accepted: nothing a customer
   * or a database column says can make this server fetch an address. Type and size are checked here as well.
   */
  function toBytes(files, key) {
    const raw = files?.[key];
    const bytes = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : null;
    if (!bytes) throw new VendorError('vendor_rejected', 'missing print files');
    const max = key === 'content' ? MAX_INTERIOR_BYTES : MAX_COVER_BYTES;
    if (bytes.length < 5 || bytes.length > max) throw new VendorError('vendor_rejected', `${key} pdf has an invalid size`);
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '%PDF') {
      throw new VendorError('vendor_rejected', `${key} is not a pdf`);
    }
    return bytes;
  }

  async function putPdf(uploadUrl, bytes) {
    let host = '';
    let proto = '';
    try { const u = new URL(uploadUrl); host = u.hostname; proto = u.protocol; } catch { /* refused below */ }
    if (proto !== 'https:' || host !== UPLOAD_HOST) {
      throw new VendorError('vendor_upload_failed', 'upload url is not on the expected storage host');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
    try {
      // Signed GCS URL: Content-Type only. The vendor token is NEVER sent to storage.
      const res = await fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: bytes,
        signal: ctrl.signal,
        redirect: 'error',
      });
      if (!res.ok) {
        // Docs: "403 Upload URL Expired - request a new one". A new attempt re-requests URLs from scratch.
        throw new VendorError('vendor_upload_failed', `upload status ${res.status}`);
      }
    } catch (e) {
      if (e instanceof VendorError) throw e;
      throw new VendorError('vendor_upload_failed', e?.name === 'AbortError' ? 'upload timeout' : safeNetErr(e));
    } finally {
      clearTimeout(timer);
    }
  }

  const bookBody = (order, uris) => {
    const [width, height] = TRIM_CM[order.preset_id || order.quote?.presetId] || [];
    if (!width) throw new VendorError('vendor_rejected', 'unknown print size');
    return {
      title: String(order.quote?.bookTitle || `order-${order.id}`).slice(0, 120),
      category: ['childrens'],
      bookType: 'print',
      ...BOOK_SPEC,
      width,
      height,
      status: false, // never displayed in the partner's public store
      contentUrl: uris.content,
      coverUrl: uris.cover,
    };
  };

  function orderBody(order, bookid) {
    return {
      shippingDetails: buildShippingDetails(order, env),
      items: [{ bookid, quantity: order.qty }],
    };
  }

  async function priceOf(order, bookid) {
    const { data } = await call('POST', '/orders/price', orderBody(order, bookid));
    if (!data || data.success !== true || data.priceable !== true) {
      const why = (data?.validationErrors || []).map((v) => `${v.code}`).join(',');
      throw new VendorError('vendor_price_mismatch', `price unavailable ${why}`.trim());
    }
    // Fail closed on anything that is not a plain, finite, positive ILS amount.
    const total = data.total;
    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
      throw new VendorError('vendor_price_mismatch', 'partner price is not a finite positive number');
    }
    if (data.currency !== 'ILS') throw new VendorError('vendor_price_mismatch', 'partner price is not in ILS');
    const agorot = Math.round(total * 100);
    if (!Number.isSafeInteger(agorot) || agorot <= 0) throw new VendorError('vendor_price_mismatch', 'partner price out of range');
    return { totalAgorot: agorot, raw: data };
  }

  function checkPrice(order, totalAgorot) {
    let expected;
    let margin;
    let ceiling;
    try {
      expected = expectedVendorTotalAgorot(order, env);
      margin = priceMarginAgorot(env);
      ceiling = maxOrderAgorot(env);
    } catch (e) {
      throw new VendorError(e?.code === 'config_invalid' ? 'vendor_not_configured' : 'vendor_rejected', `cannot compute expected cost: ${e.message}`);
    }
    // Written so that NaN / Infinity can never pass: only a comparison that is TRUE lets the order through.
    const withinMargin = Math.abs(totalAgorot - expected) <= margin;
    const underCeiling = totalAgorot <= ceiling;
    if (!(withinMargin && underCeiling)) {
      throw new VendorError(
        'vendor_price_mismatch',
        `partner price ${totalAgorot} differs from expected ${expected} by more than ${margin} (agorot) or exceeds the ceiling`,
      );
    }
    return { expected, margin };
  }

  /** Short hash of the exact request body (address, book, quantity, reference). Binds an approval to the request. */
  const fingerprintOf = (body) => crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);

  /**
   * Steps 4 + 5: price gate (fail closed), then the only call that creates an order.
   * approval = { totalAgorot, fingerprint } (first-order flow): the fresh price must EQUAL the approved amount
   * and the body must hash to the approved fingerprint, otherwise nothing is ordered.
   */
  async function placeChecked(order, bookid, approval = null) {
    const body = orderBody(order, bookid);
    if (approval) {
      if (approval.fingerprint !== fingerprintOf(body)) {
        throw new VendorError('vendor_price_mismatch', 'order request differs from the approved request');
      }
    }
    const { totalAgorot } = await priceOf(order, bookid);
    if (approval && totalAgorot !== approval.totalAgorot) {
      throw new VendorError(
        'vendor_price_mismatch',
        `price changed since approval (approved ${approval.totalAgorot}, now ${totalAgorot})`,
      );
    }
    checkPrice(order, totalAgorot);
    const { status, data } = await call('POST', '/orders', body, { stage: 'order' });
    const orderNo = data?.order_no != null ? String(data.order_no) : '';
    if (data?.success !== true || !orderNo) {
      throw new VendorError('vendor_unknown', 'order response not understood', { unknownOutcome: true });
    }
    if (status === 202 || data.hasErrors || data.status === 'CREATED_ERROR') {
      const codes = (data.errors || []).map((x) => `${x.code}`).join(',');
      throw new VendorError('vendor_created_with_errors', `order_no ${orderNo} created with errors ${codes}`, {
        unknownOutcome: true,
      });
    }
    return { ref: orderNo };
  }

  return {
    async submitOrder(order, files) {
      assertEnabled();
      buildShippingDetails(order, env); // throws before any I/O if the address/contact is unusable
      const content = toBytes(files, 'content');
      const cover = toBytes(files, 'cover');

      // 1 + 2: upload
      const stamp = new Date(now()).toISOString().slice(0, 7).replace('-', '');
      const stem = `${slug(order.id)}_${stamp}`;
      const names = { contentFileName: `${stem}_v1.0.pdf`, coverFileName: `${stem}_cover_v1.0.pdf` };
      const urls = (await call('POST', '/books/upload-url', names)).data || {};
      if (!urls.contentUploadUrl || !urls.coverUploadUrl) {
        throw new VendorError('vendor_prestep_failed', 'upload-url response missing urls');
      }
      await putPdf(urls.contentUploadUrl, content);
      await putPdf(urls.coverUploadUrl, cover);

      // 3: create the (unlisted) book
      const uris = {
        content: gsUriFromUploadUrl(urls.contentUploadUrl, urls.contentFileName || names.contentFileName),
        cover: gsUriFromUploadUrl(urls.coverUploadUrl, urls.coverFileName || names.coverFileName),
      };
      if (!uris.content || !uris.cover) throw new VendorError('vendor_prestep_failed', 'cannot derive storage uri');
      const created = (await call('POST', '/books', bookBody(order, uris))).data || {};
      // TODO(docs ambiguous): Create Book documents the request only; no success-response example is given.
      // Quote: "Create a book - POST /api/v1/books (JSON) with all metadata". We accept the id under the
      // usual names and refuse (nothing ordered) if none is present.
      const bookid = Number(created.bookid ?? created.book_id ?? created.id ?? created.data?.bookid ?? created.data?.id);
      if (!Number.isInteger(bookid) || bookid <= 0) throw new VendorError('vendor_prestep_failed', 'no book id in response');

      return placeChecked(order, bookid);
    },

    /** Order an ALREADY REGISTERED book (no upload): same price gate, same order call. Used for the first live order. */
    async orderExistingBook(order, bookid, approval) {
      assertEnabled();
      if (!approval || !Number.isSafeInteger(approval.totalAgorot) || !approval.fingerprint) {
        throw new VendorError('vendor_rejected', 'an approved total and request fingerprint are required');
      }
      return placeChecked(order, bookid, approval);
    },

    /** Read-only price for an order against an existing book id. Used by the smoke test and the price gate. */
    async quote(order, bookid) {
      assertEnabled();
      const { totalAgorot, raw } = await priceOf(order, bookid);
      return {
        totalAgorot,
        expectedAgorot: expectedVendorTotalAgorot(order, env),
        fingerprint: fingerprintOf(orderBody(order, bookid)),
        raw,
      };
    },

    async getStatus(ref) {
      assertEnabled();
      const q = `?trackingNumber=${encodeURIComponent(ref)}`;
      const { data } = await call('GET', `/shipments/track${q}`);
      // Docs: status is text in the carrier's language; there is no tracking URL in the response.
      return { status: data?.status ?? 'unknown', trackingUrl: null };
    },
  };
}
