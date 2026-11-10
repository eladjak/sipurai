/**
 * What the print partner SHOULD charge us for an order, derived from our own price table.
 * The client compares this with the partner's own /orders/price answer and refuses on a gap.
 * Pure. Integer agorot.
 *
 * Basis (measured, order 42079 on 8.11.2026): 1 copy 22x22 24pp shipped = 53.66 ILS incl. VAT
 *   = 24.66 print + 29.00 shipping. Pickup has no shipping line.
 * TODO(unverified): whether the API's `total` is VAT-inclusive (as the dashboard receipt was). If it is
 * not, the first live price call will differ by ~18% and the gate will refuse: fail closed, by design.
 */
import { PRINT_PRODUCTS, PRINT_PAGE_COUNT } from '../../../src/lib/printOrder/pricing.js';

export const DEFAULT_EXPECTED_SHIP_AGOROT = 2900;
export const DEFAULT_PRICE_MARGIN_AGOROT = 200;

function intEnv(env, name, fallback) {
  const raw = env?.[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(String(raw))) throw new Error(`${name} must be a non-negative integer (agorot)`);
  return Number(raw);
}

export const priceMarginAgorot = (env = {}) => intEnv(env, 'BOOKPOD_PRICE_MARGIN_AGOROT', DEFAULT_PRICE_MARGIN_AGOROT);

export function expectedVendorTotalAgorot(order, env = {}) {
  const presetId = order?.preset_id || order?.quote?.presetId;
  const product = PRINT_PRODUCTS.find((p) => p.presetId === presetId);
  if (!product) throw new Error('unknown print preset');
  const pages = order?.page_count || order?.quote?.pageCount || PRINT_PAGE_COUNT;
  const perCopy = product.cost24Agorot + (pages - PRINT_PAGE_COUNT) * product.perExtraPageAgorot;
  const ship = order.method === 'ship' ? intEnv(env, 'BOOKPOD_EXPECTED_SHIP_AGOROT', DEFAULT_EXPECTED_SHIP_AGOROT) : 0;
  return perCopy * order.qty + ship;
}
