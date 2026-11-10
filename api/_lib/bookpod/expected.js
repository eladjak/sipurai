/**
 * What the print partner SHOULD charge us for an order, derived from our own price table.
 * The client compares this with the partner's own /orders/price answer and refuses on a gap.
 * Pure. Integer agorot. FAILS CLOSED: any non-finite, non-integer, negative or absurd input or config throws.
 *
 * Basis (measured, order 42079 on 8.11.2026, and the live price call of 10.11.2026): 1 copy 22x22 24pp shipped
 * = 53.66 ILS incl. VAT = 24.66 print + 29.00 shipping. Pickup has no shipping line.
 */
import { PRINT_PRODUCTS, PRINT_PAGE_COUNT } from '../../../src/lib/printOrder/pricing.js';

export const DEFAULT_EXPECTED_SHIP_AGOROT = 2900;
export const DEFAULT_PRICE_MARGIN_AGOROT = 200;
export const DEFAULT_MAX_ORDER_AGOROT = 100000; // 1,000 ILS: an absolute ceiling no matter what the margin says
// Hard bounds on the knobs themselves: a mistyped env var must not be able to switch the gate off.
const MAX_MARGIN_AGOROT = 1000;
const MAX_SHIP_AGOROT = 20000;
const MAX_CEILING_AGOROT = 1000000;
const MAX_QTY = 50;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.code = 'config_invalid';
  }
}

function intEnv(env, name, fallback, max) {
  const raw = env?.[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (!/^\d{1,9}$/.test(String(raw))) throw new ConfigError(`${name} must be a non-negative integer (agorot)`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > max) throw new ConfigError(`${name} is out of range (max ${max})`);
  return n;
}

export const priceMarginAgorot = (env = {}) =>
  intEnv(env, 'BOOKPOD_PRICE_MARGIN_AGOROT', DEFAULT_PRICE_MARGIN_AGOROT, MAX_MARGIN_AGOROT);
export const maxOrderAgorot = (env = {}) =>
  intEnv(env, 'BOOKPOD_MAX_ORDER_AGOROT', DEFAULT_MAX_ORDER_AGOROT, MAX_CEILING_AGOROT);

export function expectedVendorTotalAgorot(order, env = {}) {
  const presetId = order?.preset_id || order?.quote?.presetId;
  const product = PRINT_PRODUCTS.find((p) => p.presetId === presetId);
  if (!product) throw new Error('unknown print preset');
  const pages = order?.page_count ?? order?.quote?.pageCount ?? PRINT_PAGE_COUNT;
  const qty = order?.qty;
  if (!Number.isInteger(pages) || pages < 8 || pages > 80 || pages % 2 !== 0) throw new Error('invalid page count');
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error('invalid quantity');
  if (order.method !== 'ship' && order.method !== 'pickup') throw new Error('invalid method');
  const perCopy = product.cost24Agorot + (pages - PRINT_PAGE_COUNT) * product.perExtraPageAgorot;
  const ship = order.method === 'ship' ? intEnv(env, 'BOOKPOD_EXPECTED_SHIP_AGOROT', DEFAULT_EXPECTED_SHIP_AGOROT, MAX_SHIP_AGOROT) : 0;
  const total = perCopy * qty + ship;
  if (!Number.isSafeInteger(total) || total <= 0 || total > maxOrderAgorot(env)) throw new Error('expected total out of bounds');
  return total;
}
