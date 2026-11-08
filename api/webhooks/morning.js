/**
 * Vercel Serverless Function: Morning (Green Invoice) payment notification for PRINTED-book orders.
 *
 * Morning POSTs to the `notifyUrl` we gave the payment form once a payment succeeded and the
 * receipt exists. That POST is only a trigger (undocumented body, unsigned): see payment/morning.js.
 * Fail-closed order of checks:
 *   method -> feature flag (404 before ANY I/O) -> per-order token (401) -> order exists
 *   -> ask Morning for the receipt (unreachable: 503 so Morning retries; no receipt: 202, order untouched)
 *   -> handlePaymentEvent (atomic awaiting_payment -> paid, exactly one submission).
 */
import { defaultDeps, isEnabled } from '../_lib/orders/handlers.js';
import { handlePaymentEvent, isUuid, sanitize } from '../_lib/orders/service.js';

// Raw bytes are needed for the optional signature header.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function queryOf(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    return Object.fromEntries(new URL(req.url, 'http://local').searchParams);
  } catch {
    return {};
  }
}

/** `deps` is only for tests: { env, store, payment, vendor }. */
export async function handleMorningWebhook(req, res, deps) {
  const send = (status, body) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });

  const env = deps?.env || process.env;
  if (!isEnabled(env)) return send(404, { error: 'disabled' });

  try {
    const orderDeps = deps?.store ? { env, ...deps } : { ...(await defaultDeps(env)), ...deps, env };
    const payment = orderDeps.payment;
    if (typeof payment?.verifyNotify !== 'function') return send(500, { error: 'Payment provider mismatch' });

    let raw = '';
    try {
      raw = await readRawBody(req);
    } catch {
      return send(400, { error: 'Could not read body' });
    }

    let notify;
    try {
      notify = payment.verifyNotify({ query: queryOf(req), headers: req.headers || {}, raw });
    } catch (e) {
      if (e?.code === 'webhook_secret_missing') {
        console.error('[morning-webhook] MORNING_NOTIFY_SECRET not configured');
        return send(500, { error: 'Webhook secret not configured' });
      }
      console.warn('[morning-webhook] rejected notify:', e?.code || 'unknown');
      return send(401, { error: 'Invalid token' });
    }

    if (!isUuid(notify.orderId)) return send(200, { received: true, outcome: 'unknown_order' });
    const order = await orderDeps.store.getOrder(notify.orderId);
    if (!order) return send(200, { received: true, outcome: 'unknown_order' });

    let evt;
    try {
      evt = await payment.confirmPayment(order, { documentId: notify.documentId });
    } catch (e) {
      // We could not look. Do not guess: ask Morning to deliver again.
      console.error('[morning-webhook] confirm failed:', e?.code || 'unknown', sanitize(e?.message));
      return send(503, { error: 'Could not verify payment, retry' });
    }
    if (!evt) {
      await orderDeps.store.addEvent(order.id, 'payment_unverified', { documentId: notify.documentId || null });
      return send(202, { received: true, outcome: 'unverified' });
    }

    const result = await handlePaymentEvent(orderDeps, evt);
    console.info('[morning-webhook] print order event:', result.outcome);
    return send(200, { received: true });
  } catch (e) {
    console.error('[morning-webhook] processing error:', sanitize(e?.message));
    return send(500, { error: 'Internal server error' });
  }
}

export default function handler(req, res) {
  return handleMorningWebhook(req, res);
}
