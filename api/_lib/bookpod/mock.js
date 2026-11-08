/** Scriptable vendor mock for tests. Records every call. */
import { VendorError } from './client.js';

/**
 * @param {Array<'success'|'timeout'|'reject'|'disabled'|'unknown'>} script outcomes consumed one per
 *        submitOrder call; once exhausted the last one repeats (default: success).
 */
export function createMockVendor(script = ['success']) {
  const calls = [];
  const queue = [...script];
  let counter = 0;
  return {
    calls,
    async submitOrder(order, files) {
      calls.push({ orderId: order.id, files });
      const outcome = queue.length > 1 ? queue.shift() : queue[0] || 'success';
      if (outcome === 'timeout') throw new VendorError('vendor_timeout', 'timed out', { unknownOutcome: true });
      if (outcome === 'unknown') throw new VendorError('vendor_unknown', 'connection reset', { unknownOutcome: true });
      if (outcome === 'reject') throw new VendorError('vendor_rejected', 'status 422');
      if (outcome === 'disabled') throw new VendorError('vendor_disabled', 'off');
      counter += 1;
      return { ref: `mock-ref-${counter}` };
    },
    async getStatus(ref) {
      return { status: 'in_production', trackingUrl: null, ref };
    },
  };
}
