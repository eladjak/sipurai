/**
 * Creem payment adapter for printed-book orders.
 * Interface: createCheckout(order) -> {url, ref}; verifyWebhook(raw, headers) -> normalized event.
 * Signature scheme is identical to api/webhooks/creem.js: HMAC-SHA256 hex of the RAW
 * body, header x-creem-signature.
 */
import crypto from 'node:crypto';

export class PaymentError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'PaymentError';
    this.code = code;
  }
}

export function creemApiBase(env = process.env) {
  if (env.CREEM_API_BASE) return env.CREEM_API_BASE.replace(/\/+$/, '');
  return env.CREEM_TEST_MODE === 'true' ? 'https://test-api.creem.io' : 'https://api.creem.io';
}

export function verifyHmacHex(rawBody, signature, secret) {
  if (!secret || !signature || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = Buffer.from(signature, 'hex');
  const want = Buffer.from(expected, 'hex');
  if (given.length !== want.length) return false;
  try {
    return crypto.timingSafeEqual(given, want);
  } catch {
    return false;
  }
}

/**
 * Normalize a (already signature-verified) Creem event.
 * Returns null when it is not a checkout.completed event.
 * Creem sends `eventType` + `object`; the older handler also reads `type` + `data`, so both are accepted.
 */
export function normalizeCreemEvent(event) {
  const type = event?.eventType || event?.type || event?.event_type;
  if (type !== 'checkout.completed') return null;
  const obj = event.object || event.data || event;
  const orderId = obj?.metadata?.order_id || obj?.request_id || event?.metadata?.order_id || null;
  const amount = obj?.order?.amount_paid ?? obj?.order?.amount ?? obj?.amount;
  return {
    eventId: event.id || null,
    type,
    orderId: typeof orderId === 'string' ? orderId : null,
    paymentRef: obj?.id || null,
    amountAgorot: Number.isInteger(amount) ? amount : null,
    currency: obj?.order?.currency || obj?.currency || null,
  };
}

export function createCreemPayment({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return {
    name: 'creem',

    async createCheckout(order) {
      const apiKey = env.CREEM_API_KEY;
      const productId = env.CREEM_PRINT_PRODUCT_ID;
      if (!apiKey || !productId) throw new PaymentError('payment_not_configured');

      const payload = {
        product_id: productId,
        units: 1,
        custom_price: order.total_agorot, // minor units (agorot), integer
        request_id: order.id,
        metadata: { order_id: order.id },
        // TODO(unverified): Creem has no documented cancel_url here; the shopper returns via the browser back button.
        success_url: `https://sipurai.ai/orders?paid=1&order=${encodeURIComponent(order.id)}`,
      };
      let res;
      try {
        res = await fetchImpl(`${creemApiBase(env)}/v1/checkouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        throw new PaymentError('payment_unreachable', e.message);
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) throw new PaymentError('payment_rejected', `status ${res.status}`);
      const url = data?.checkout_url || data?.url;
      if (!url || !data?.id) throw new PaymentError('payment_bad_response');
      return { url, ref: data.id };
    },

    verifyWebhook(raw, headers = {}) {
      const secret = env.CREEM_WEBHOOK_SECRET;
      if (!secret) throw new PaymentError('webhook_secret_missing');
      if (!verifyHmacHex(raw, headers['x-creem-signature'], secret)) {
        throw new PaymentError('bad_signature');
      }
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        throw new PaymentError('bad_json');
      }
      return normalizeCreemEvent(event);
    },
  };
}
