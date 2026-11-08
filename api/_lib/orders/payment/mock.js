/**
 * Deterministic mock payment provider for tests. Never selected by default code paths.
 * Events are Creem-shaped so the same normalizer is exercised.
 */
import crypto from 'node:crypto';
import { PaymentError, verifyHmacHex, normalizeCreemEvent } from './creem.js';

export const MOCK_SECRET = 'mock-webhook-secret';

export function createMockPayment({ secret = MOCK_SECRET } = {}) {
  const checkouts = [];
  return {
    name: 'mock',
    checkouts,

    async createCheckout(order) {
      const ref = `mock_co_${order.id}`;
      checkouts.push({ orderId: order.id, amount: order.total_agorot });
      return { url: `https://pay.mock.test/checkout/${order.id}`, ref };
    },

    verifyWebhook(raw, headers = {}) {
      if (!verifyHmacHex(raw, headers['x-creem-signature'], secret)) throw new PaymentError('bad_signature');
      return normalizeCreemEvent(JSON.parse(raw));
    },

    /** Build a signed checkout.completed delivery. */
    buildCompletedEvent(order, { eventId = `evt_${crypto.randomUUID()}`, amountAgorot, checkoutId } = {}) {
      const event = {
        id: eventId,
        eventType: 'checkout.completed',
        object: {
          id: checkoutId || `mock_co_${order.id}`,
          request_id: order.id,
          order: { amount: amountAgorot ?? order.total_agorot, currency: 'ILS', status: 'paid' },
          metadata: { order_id: order.id },
        },
      };
      const raw = JSON.stringify(event);
      const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      return { event, raw, headers: { 'x-creem-signature': signature } };
    },
  };
}
