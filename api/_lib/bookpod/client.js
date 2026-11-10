/**
 * Print-fulfilment vendor client (server only; this path and name must never
 * reach any response body, src/ or public/).
 *
 * Implements the vendor's OFFICIAL API (Oct-2026 docs: Create Book v5.1, Create Order v1.2,
 * Calculate Order Price v1.1, Shipment Tracking v1.1). Headers: x-user-id + x-custom-token.
 *
 * Interface (unchanged for service.js):
 *   submitOrder(order, files) -> {ref}      files = {content, cover} (bytes) | {contentUrl, coverUrl} (https)
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
import { expectedVendorTotalAgorot, priceMarginAgorot } from './expected.js';

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
const API = '/api/v1';
const TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 170000;
const BREAKER_MS = 10 * 60 * 1000;

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

  function assertEnabled() {
    if (!isVendorEnabled(env)) throw new VendorError('vendor_disabled', 'fulfillment is switched off');
    if (!env.BOOKPOD_USER_ID) throw new VendorError('vendor_not_configured', 'fulfillment is not configured');
    if (now() < breakerUntil) {
      throw new VendorError(breakerCode, 'authentication with the print partner is failing; call skipped');
    }
  }
  const base = () => (env.BOOKPOD_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');

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
      });
    } catch (e) {
      const timedOut = e?.name === 'AbortError';
      if (stage === 'order') {
        throw new VendorError(timedOut ? 'vendor_timeout' : 'vendor_unknown', e?.message, { unknownOutcome: true });
      }
      throw new VendorError('vendor_prestep_failed', `${path}: ${timedOut ? 'timeout' : e?.message}`);
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
    if (status === 401 || status === 403) {
      // Docs (Shipment Tracking, Common Errors): "401 Token expired" / "401 Invalid token or user ID" /
      // "403 The token is not enabled for the API".
      const text = JSON.stringify(data || {});
      const code = status === 401 && /expired/i.test(text) ? 'vendor_token_expired' : 'vendor_auth_failed';
      breakerUntil = now() + BREAKER_MS;
      breakerCode = code;
      throw new VendorError(code, `status ${status}`);
    }
    if (status >= 400 && status < 500) {
      const first = data?.errors?.[0];
      const detail = first ? `${first.code}: ${first.message}` : data?.code ? `${data.code}: ${data.message}` : data?.error || '';
      if (stage === 'order' && (first?.code === 1502 || data?.code === 1502)) {
        // 1502 = "reference_num1 already exists": the order is already at the vendor.
        throw new VendorError('vendor_duplicate_reference', 'reference already exists', { unknownOutcome: true });
      }
      throw new VendorError('vendor_rejected', `status ${status} ${detail}`.trim());
    }
    if (status >= 500) {
      if (stage === 'order') throw new VendorError('vendor_unknown', `status ${status}`, { unknownOutcome: true });
      throw new VendorError('vendor_prestep_failed', `${path}: status ${status}`);
    }
    return { status, data };
  }

  async function toBytes(files, key) {
    const direct = files?.[key];
    if (direct) return direct instanceof Uint8Array ? direct : new Uint8Array(direct);
    const url = files?.[`${key}Url`];
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) {
      throw new VendorError('vendor_rejected', 'missing print files');
    }
    let res;
    try {
      res = await fetchImpl(url, { method: 'GET' });
    } catch (e) {
      throw new VendorError('vendor_prestep_failed', `print file download failed: ${e?.message}`);
    }
    if (!res.ok) throw new VendorError('vendor_prestep_failed', `print file download status ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function putPdf(uploadUrl, bytes) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
    try {
      // Signed GCS URL: Content-Type only. The vendor token is NEVER sent to storage.
      const res = await fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: bytes,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // Docs: "403 Upload URL Expired - request a new one". A new attempt re-requests URLs from scratch.
        throw new VendorError('vendor_upload_failed', `upload status ${res.status}`);
      }
    } catch (e) {
      if (e instanceof VendorError) throw e;
      throw new VendorError('vendor_upload_failed', e?.name === 'AbortError' ? 'upload timeout' : e?.message);
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
    if (!data || data.success !== true || data.priceable !== true || !(Number(data.total) > 0)) {
      const why = (data?.validationErrors || []).map((v) => `${v.code}`).join(',');
      throw new VendorError('vendor_price_mismatch', `price unavailable ${why}`.trim());
    }
    return { totalAgorot: Math.round(Number(data.total) * 100), raw: data };
  }

  function checkPrice(order, totalAgorot) {
    let expected;
    let margin;
    try {
      expected = expectedVendorTotalAgorot(order, env);
      margin = priceMarginAgorot(env);
    } catch (e) {
      throw new VendorError('vendor_rejected', `cannot compute expected cost: ${e.message}`);
    }
    if (Math.abs(totalAgorot - expected) > margin) {
      throw new VendorError(
        'vendor_price_mismatch',
        `partner price ${totalAgorot} differs from expected ${expected} by more than ${margin} (agorot)`,
      );
    }
    return { expected, margin };
  }

  /** Steps 4 + 5: price gate (fail closed), then the only call that creates an order. */
  async function placeChecked(order, bookid) {
    const { totalAgorot } = await priceOf(order, bookid);
    checkPrice(order, totalAgorot);
    const { status, data } = await call('POST', '/orders', orderBody(order, bookid), { stage: 'order' });
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
      const content = await toBytes(files, 'content');
      const cover = await toBytes(files, 'cover');

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
    async orderExistingBook(order, bookid) {
      assertEnabled();
      return placeChecked(order, bookid);
    },

    /** Read-only price for an order against an existing book id. Used by the smoke test and the price gate. */
    async quote(order, bookid) {
      assertEnabled();
      const { totalAgorot, raw } = await priceOf(order, bookid);
      return { totalAgorot, expectedAgorot: expectedVendorTotalAgorot(order, env), raw };
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
