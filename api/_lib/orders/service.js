/**
 * Order business logic. Pure orchestration over injected deps:
 *   deps = { store, payment, vendor, env, getPrintFiles?, now?, fetchImpl? }
 *
 * Concurrency model: every status change is an atomic compare-and-set
 * (store.transition with the list of statuses it may start from). The caller
 * that wins the CAS owns the side effect; losers get "duplicate" and do nothing.
 */
import crypto from 'node:crypto';
import { computeQuote, PRINT_PAGE_COUNT, PricingError } from '../../../src/lib/printOrder/pricing.js';
import { validateAddress } from './address.js';
import { SAFE_VENDOR_CODES } from '../bookpod/client.js';
import { STATUS_LABEL_HE, canTransition } from './states.js';

export class OrderError extends Error {
  constructor(code, status, message_he) {
    super(code);
    this.name = 'OrderError';
    this.code = code;
    this.status = status;
    this.message_he = message_he;
  }
}

/** Strip any vendor identity from text that could reach a response body. */
export function sanitize(text) {
  return String(text ?? '')
    .replace(/book\s*pod/gi, 'fulfillment')
    .replace(/בוקפוד/g, 'שותף ההדפסה')
    .slice(0, 300);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/* ------------------------------ views ------------------------------ */
export function orderView(row) {
  return {
    id: row.id,
    status: row.status,
    bookId: row.book_id,
    bookTitle: row.quote?.bookTitle || '',
    presetId: row.preset_id,
    qty: row.qty,
    method: row.method,
    totalAgorot: row.total_agorot,
    createdAt: row.created_at,
    ...(row.paid_at ? { paidAt: row.paid_at } : {}),
    ...(row.tracking_url ? { trackingUrl: row.tracking_url } : {}),
    statusLabel_he: STATUS_LABEL_HE[row.status] || row.status,
  };
}

export function adminOrderView(row) {
  return {
    ...orderView(row),
    userId: row.user_id,
    address: row.address,
    pageCount: row.page_count,
    priceVersion: row.quote?.priceVersion,
    paymentRef: row.payment_ref,
    fulfillmentRef: row.vendor_ref,
    submitAttempts: row.vendor_submit_attempts,
    lastError: row.vendor_last_error ? sanitize(row.vendor_last_error) : null,
  };
}

/* ------------------------------ create ----------------------------- */
const KEY_RE = /^[A-Za-z0-9_:.-]{8,80}$/;

export async function createOrder(deps, { userId, body }) {
  const { store, payment, env } = deps;
  const b = body && typeof body === 'object' ? body : {};
  const { bookId, qty, method, idempotencyKey } = b;

  if (typeof bookId !== 'string' || !bookId || bookId.length > 64) {
    throw new OrderError('invalid_book', 400, 'נא לבחור ספר');
  }
  if (typeof idempotencyKey !== 'string' || !KEY_RE.test(idempotencyKey)) {
    throw new OrderError('invalid_idempotency_key', 400, 'בקשה לא תקינה, נא לנסות שוב');
  }

  let existing = await store.findByKey(userId, idempotencyKey);
  if (!existing) {
    const book = await store.getBook(bookId);
    // Not found and "someone else's" look identical on purpose.
    if (!book || book.ownerId !== userId) throw new OrderError('book_not_found', 404, 'הספר לא נמצא');

    let quote;
    try {
      quote = computeQuote(
        { presetId: book.printSize || 'square-220', pageCount: PRINT_PAGE_COUNT, qty, method },
        { env },
      );
    } catch (e) {
      throw pricingToOrderError(e);
    }
    const addr = validateAddress(b.address, method);
    if (!addr.ok) {
      const err = new OrderError('invalid_address', 400, 'יש לתקן את פרטי המשלוח');
      err.fields = addr.errors;
      throw err;
    }

    const res = await store.insertOrder({
      user_id: userId,
      book_id: book.id,
      preset_id: quote.presetId,
      page_count: quote.pageCount,
      qty: quote.qty,
      method: quote.method,
      address: addr.address,
      quote: { ...quote, bookTitle: book.title },
      total_agorot: quote.totalAgorot,
      currency: quote.currency,
      idempotency_key: idempotencyKey,
      payment_provider: payment.name,
    });
    existing = res.order;
    if (res.created) await store.addEvent(existing.id, 'created', { totalAgorot: existing.total_agorot });
  }

  let order = existing;
  if (order.status === 'awaiting_payment' && !order.checkout_url) {
    try {
      const { url, ref } = await payment.createCheckout(order);
      order = (await store.update(order.id, { checkout_url: url, payment_ref: ref, payment_provider: payment.name })) || order;
      await store.addEvent(order.id, 'checkout_created', { ref });
    } catch (e) {
      if (e?.code === '23505') throw e;
      await store.addEvent(order.id, 'checkout_failed', { code: e?.code || 'unknown' });
      throw new OrderError('checkout_failed', 502, 'לא הצלחנו לפתוח את מסך התשלום. אפשר לנסות שוב, לא חויבת.');
    }
  }
  return {
    orderId: order.id,
    status: order.status,
    checkoutUrl: order.status === 'awaiting_payment' ? order.checkout_url : null,
  };
}

export function pricingToOrderError(e) {
  if (e instanceof PricingError) {
    const status = e.code === 'size_not_available' ? 409 : 400;
    return new OrderError(e.code, status, e.message_he);
  }
  return e;
}

/* ----------------------------- payment ----------------------------- */
/**
 * Apply a normalized, signature-verified "checkout completed" event.
 * @returns {{outcome:'paid'|'duplicate'|'mismatch'|'unknown_order'|'paid_after_cancel', submit?:object}}
 */
export async function handlePaymentEvent(deps, evt) {
  const { store, payment } = deps;
  if (!isUuid(evt?.orderId)) return { outcome: 'unknown_order' };
  const order = await store.getOrder(evt.orderId);
  if (!order) return { outcome: 'unknown_order' };

  const amountOk =
    Number.isInteger(evt.amountAgorot) &&
    evt.amountAgorot === order.total_agorot &&
    (!evt.currency || String(evt.currency).toUpperCase() === order.currency);
  const paymentPatch = {
    payment_provider: payment?.name || order.payment_provider,
    payment_ref: evt.paymentRef || order.payment_ref,
  };

  if (!amountOk) {
    // Money arrived but not the amount we asked for: never fulfil, flag for a human.
    const moved = await store.transition(order.id, ['awaiting_payment', 'cancelled'], {
      ...paymentPatch,
      status: 'failed_needs_attention',
      vendor_last_error: `amount_mismatch: paid ${evt.amountAgorot} ${evt.currency || ''} expected ${order.total_agorot} ${order.currency}`.trim(),
    });
    if (!moved) {
      await store.addEvent(order.id, 'payment_event_ignored', { eventId: evt.eventId, reason: 'not_awaiting' });
      return { outcome: 'duplicate' };
    }
    await store.addEvent(order.id, 'payment_amount_mismatch', {
      eventId: evt.eventId,
      paid: evt.amountAgorot,
      expected: order.total_agorot,
    });
    await store.addEvent(order.id, 'alert_amount_mismatch', { expected: order.total_agorot, paid: evt.amountAgorot });
    return { outcome: 'mismatch' };
  }

  if (order.status === 'cancelled') {
    const moved = await store.transition(order.id, ['cancelled'], {
      ...paymentPatch,
      status: 'failed_needs_attention',
      paid_at: new Date().toISOString(),
      vendor_last_error: 'paid_after_cancel: money received for a cancelled order, refund or reinstate',
    });
    if (!moved) return { outcome: 'duplicate' };
    await store.addEvent(order.id, 'alert_paid_after_cancel', { eventId: evt.eventId });
    return { outcome: 'paid_after_cancel' };
  }

  // IDEMPOTENCY GUARD: only the delivery that flips awaiting_payment -> paid proceeds.
  const paid = await store.transition(order.id, ['awaiting_payment'], {
    ...paymentPatch,
    status: 'paid',
    paid_at: new Date().toISOString(),
  });
  if (!paid) {
    await store.addEvent(order.id, 'payment_event_ignored', { eventId: evt.eventId, reason: 'already_processed' });
    return { outcome: 'duplicate' };
  }
  await store.addEvent(order.id, 'paid', {
    eventId: evt.eventId,
    paymentRef: evt.paymentRef,
    ...(evt.receiptNumber != null ? { receiptNumber: evt.receiptNumber } : {}),
  });

  let submit;
  try {
    submit = await submitOrder(deps, order.id, { explicit: false });
  } catch (e) {
    // The payment is recorded; a failed submit must never turn the webhook into a retry storm.
    await store.addEvent(order.id, 'submit_error', { code: e?.code || 'unknown' });
  }
  return { outcome: 'paid', submit };
}

/* ----------------------------- fulfilment -------------------------- */
/**
 * Submit a paid order to the print partner. Never retried automatically after an
 * unknown outcome: the admin must call it again explicitly (explicit:true).
 */
export async function submitOrder(deps, orderId, { explicit = false } = {}) {
  const { store, vendor } = deps;
  const order = await store.getOrder(orderId);
  if (!order) throw new OrderError('not_found', 404, 'ההזמנה לא נמצאה');

  if (order.status === 'failed_needs_attention') {
    if (!explicit) throw new OrderError('retry_not_allowed', 409, 'נדרש אישור ידני לניסיון נוסף');
    if (!order.paid_at || String(order.vendor_last_error || '').startsWith('amount_mismatch')) {
      throw new OrderError('retry_not_allowed', 409, 'אי אפשר לשלוח הזמנה שלא שולמה במלואה');
    }
  }

  // CLAIM: only one caller can move the order into "submitting".
  const claimed = await store.transition(orderId, explicit ? ['paid', 'failed_needs_attention'] : ['paid'], {
    status: 'submitting',
  });
  if (!claimed) return { outcome: 'not_claimed' };
  await store.update(orderId, { vendor_submit_attempts: (order.vendor_submit_attempts || 0) + 1 });
  await store.addEvent(orderId, 'submit_started', { explicit });

  const book = await store.getBook(order.book_id);
  let files;
  try {
    files = deps.getPrintFiles ? await deps.getPrintFiles(claimed, book) : book?.printFiles || null;
  } catch (e) {
    // e.g. artwork below 300 dpi, or the generator ran out of time/memory: nothing was sent.
    await store.transition(orderId, ['submitting'], {
      status: 'failed_needs_attention',
      vendor_last_error: `print_files_error: ${sanitize(e?.message)}`,
    });
    await store.addEvent(orderId, 'alert_print_files_error', {});
    return { outcome: 'files_error' };
  }
  if (!files) {
    await store.transition(orderId, ['submitting'], {
      status: 'failed_needs_attention',
      vendor_last_error: 'print_files_missing',
    });
    await store.addEvent(orderId, 'alert_print_files_missing', {});
    return { outcome: 'files_missing' };
  }

  try {
    const { ref } = await vendor.submitOrder(claimed, files);
    await store.transition(orderId, ['submitting'], { status: 'submitted', vendor_ref: ref, vendor_last_error: null });
    await store.addEvent(orderId, 'submitted', { ref });
    return { outcome: 'submitted', ref };
  } catch (e) {
    const code = e?.code || 'vendor_unknown';
    const msg = sanitize(e?.message);
    if (code === 'vendor_disabled' || code === 'vendor_not_configured') {
      // Definitely nothing was sent: back to paid, the cron will raise an alert if it stays there.
      await store.transition(orderId, ['submitting'], { status: 'paid', vendor_last_error: code });
      await store.addEvent(orderId, 'submit_skipped', { code });
      return { outcome: 'disabled' };
    }
    // Only codes that PROVE nothing was ordered are safe; anything else is an unknown outcome.
    const unknown = !SAFE_VENDOR_CODES.has(code);
    const lastError = unknown
      ? `unknown_outcome(${code}): the order may already exist at the partner, verify before retrying. ${msg}`
      : code === 'vendor_token_expired'
        ? 'token_expired: nothing was ordered. Renew the partner API token, then retry from the admin screen.'
        : code === 'vendor_auth_failed'
          ? `auth_failed: nothing was ordered. Check the partner credentials, then retry. ${msg}`
          : code === 'vendor_price_mismatch'
            ? `price_mismatch: nothing was ordered, the partner price is not what we expect. ${msg}`
            : `rejected: ${msg}`;
    await store.transition(orderId, ['submitting'], { status: 'failed_needs_attention', vendor_last_error: lastError });
    await store.addEvent(orderId, unknown ? 'submit_unknown_outcome' : 'submit_rejected', { code });
    await store.addEvent(orderId, 'alert_submit_failed', { code, unknownOutcome: unknown });
    if (code === 'vendor_token_expired' || code === 'vendor_auth_failed') {
      await store.addEvent(orderId, 'alert_vendor_auth', { code });
    }
    if (code === 'vendor_price_mismatch') await store.addEvent(orderId, 'alert_price_mismatch', {});
    return { outcome: unknown ? 'unknown_outcome' : 'rejected', code };
  }
}

/* ------------------------------ admin ------------------------------ */
export async function adminAction(deps, { id, action, note, actor }) {
  const { store } = deps;
  if (!isUuid(id)) throw new OrderError('invalid_id', 400, 'מזהה הזמנה לא תקין');
  const order = await store.getOrder(id);
  if (!order) throw new OrderError('not_found', 404, 'ההזמנה לא נמצאה');
  const cleanNote = typeof note === 'string' ? sanitize(note).slice(0, 200) : undefined;

  const move = async (from, to, patch = {}) => {
    if (!from.every((s) => canTransition(s, to))) throw new Error(`invalid transition table for ${to}`);
    const row = await store.transition(id, from, { ...patch, status: to });
    if (!row) throw new OrderError('invalid_transition', 409, 'אי אפשר לבצע את הפעולה במצב הנוכחי של ההזמנה');
    await store.addEvent(id, `admin_${action}`, { actor, note: cleanNote });
    return row;
  };

  switch (action) {
    case 'retry_submit': {
      await store.addEvent(id, 'admin_retry_submit', { actor, note: cleanNote });
      const result = await submitOrder(deps, id, { explicit: true });
      if (result.outcome === 'not_claimed') {
        throw new OrderError('invalid_transition', 409, 'אי אפשר לבצע את הפעולה במצב הנוכחי של ההזמנה');
      }
      return { order: await store.getOrder(id), result };
    }
    case 'mark_ready_for_pickup':
      if (order.method !== 'pickup') throw new OrderError('not_pickup', 409, 'ההזמנה אינה לאיסוף עצמי');
      return { order: await move(['paid', 'submitted', 'in_production'], 'ready_for_pickup') };
    case 'mark_shipped': {
      if (order.method !== 'ship') throw new OrderError('not_ship', 409, 'ההזמנה אינה למשלוח');
      const tracking = cleanNote && /^https:\/\/\S+$/.test(cleanNote) ? { tracking_url: cleanNote } : {};
      return { order: await move(['submitted', 'in_production'], 'shipped', tracking) };
    }
    case 'cancel':
      return { order: await move(['awaiting_payment', 'failed_needs_attention'], 'cancelled') };
    default:
      throw new OrderError('invalid_action', 400, 'פעולה לא מוכרת');
  }
}

/* ------------------------------- cron ------------------------------ */
export async function runStuckWatch(deps) {
  const { store, env, fetchImpl = globalThis.fetch, now = () => new Date() } = deps;
  const paidBefore = new Date(now().getTime() - 2 * 3600 * 1000).toISOString();
  const stuck = await store.listStuck({ paidBefore });
  const fresh = [];
  for (const o of stuck) {
    const key = `alert_stuck:${o.status}`;
    if (await store.hasEvent(o.id, key)) continue;
    await store.addEvent(o.id, key, { status: o.status, paidAt: o.paid_at, lastError: sanitize(o.vendor_last_error) });
    fresh.push(o);
  }

  let delivery = 'not_configured';
  const url = env.PRINT_ALERT_WEBHOOK_URL;
  if (url) {
    // Everything stuck whose alert was not delivered yet (covers a failed earlier delivery).
    const toSend = [];
    for (const o of stuck) {
      if (!(await store.hasEvent(o.id, `alert_delivered:${o.status}`))) toSend.push(o);
    }
    if (toSend.length === 0) {
      delivery = 'nothing_to_send';
    } else {
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${toSend.length} הזמנות הדפסה תקועות וממתינות לטיפול`,
            orders: toSend.map((o) => ({ id: o.id, status: o.status, paidAt: o.paid_at })),
          }),
        });
        if (res.ok) {
          for (const o of toSend) await store.addEvent(o.id, `alert_delivered:${o.status}`, {});
          delivery = 'sent';
        } else {
          delivery = `failed_${res.status}`;
        }
      } catch (e) {
        delivery = `failed_${sanitize(e?.message).slice(0, 60)}`;
      }
    }
  }
  return { checked: stuck.length, newAlerts: fresh.length, delivery };
}

export const newIdempotencyKey = () => crypto.randomUUID();
