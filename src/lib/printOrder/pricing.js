/**
 * Printed-book pricing. Pure: no I/O, integer agorot only.
 *
 * Shared by the server (authoritative) and the UI (display only). The server
 * recomputes every quote itself and stores the result as a snapshot on the
 * order, so a later price change never alters an order already created.
 *
 * Rules:
 *  - Print cost figures include 18% VAT (the amounts below are VAT-inclusive).
 *  - Unit price = ceil-to-whole-ILS(cost incl. VAT + margin).
 *  - Shipping is a separate flat line (once per order). Pickup costs 0.
 *  - Nonhistorical standard stock uses exact calculator observations only when
 *    the legacy estimate opt-in is enabled; chrome requires a specific quote.
 */

import { isSupportedPageCount } from '../printSpec.js';
import { STANDARD_ESTIMATES } from './standardRates.js';

export const PRICE_VERSION = '2026-11-18.v2';
export const PAPER_SHEET_TYPES = Object.freeze({ standard: 'wood-free-white-110', 'chrome-matte-130': 'chromo-mat-130', 'chrome-matte-170': 'chromo-mat-170' });
export const HARDCOVER_ENABLED = false; // No verified single-copy hardcover product.
const COVER_OPTIONS = Object.freeze({
  softcover: Object.freeze({ enabled: true, vendorFinish: 'soft' }),
  hardcover: Object.freeze({ enabled: HARDCOVER_ENABLED, vendorFinish: null }),
});

/** A cover requires both an enabled policy and an implemented vendor formatter. */
export function vendorFinishForCover(cover) {
  if (typeof cover !== 'string' || !Object.hasOwn(COVER_OPTIONS, cover)) return null;
  const option = COVER_OPTIONS[cover];
  return option.enabled && option.vendorFinish ? option.vendorFinish : null;
}
export const VAT_RATE_PERCENT = 18;
const MAX_AGOROT = 100_000_000;
const MAX_QTY = 1000;
export const DEFAULT_MARGIN_AGOROT = 5434; // 24.66 + 54.34 = 79.00 ILS for the verified size
export const DEFAULT_SHIP_AGOROT = 2900;
export const DEFAULT_MAX_QTY = 10;
export const PRINT_PAGE_COUNT = 24; // Page count for the previously quoted physical product.

/** Supported physical size identifiers; availability depends on an exact quote. */
export const PRINT_PRODUCTS = Object.freeze([
  Object.freeze({ presetId: 'square-220', label_he: 'ריבוע 22×22 ס"מ' }),
  Object.freeze({ presetId: 'square-200', label_he: 'ריבוע 20×20 ס"מ' }),
  Object.freeze({ presetId: 'portrait-165x235', label_he: 'לאורך 16.5×23.5 ס"מ' }),
]);

export class PricingError extends Error {
  constructor(code, message_he) {
    super(code);
    this.name = 'PricingError';
    this.code = code;
    this.message_he = message_he;
  }
}

const ceilToWholeIls = (agorot) => Math.ceil(agorot / 100) * 100;

function intEnv(env, name, fallback) {
  const raw = env?.[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(String(raw))) {
    throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
  return value;
}

/** Public, safe-to-display settings derived from env. */
export function getPricingSettings(env = {}) {
  return {
    marginAgorot: intEnv(env, 'PRINT_MARGIN_AGOROT', DEFAULT_MARGIN_AGOROT),
    shipAgorot: intEnv(env, 'PRINT_SHIP_AGOROT', DEFAULT_SHIP_AGOROT),
    maxQty: intEnv(env, 'PRINT_MAX_QTY', DEFAULT_MAX_QTY),
    allowUnverified: env?.PRINT_ALLOW_UNVERIFIED_SIZES === 'true',
    pickupEnabled: env?.PRINT_PICKUP_ENABLED === 'true',
  };
}

export function vatIncludedAgorot(totalAgorot) {
  return Math.round((totalAgorot * VAT_RATE_PERCENT) / (100 + VAT_RATE_PERCENT));
}

/**
 * @param {{presetId:string,pageCount?:number,qty:number,method:'ship'|'pickup'}} input
 * @param {{env?:object}} [opts]
 * @returns the Quote of the API contract (+ priceVersion, vatAgorot, verified).
 */
export function computeQuote(input, { env = {} } = {}) {
  const { presetId, qty, method } = input || {};
  const paper = input?.paper === undefined ? 'standard' : input.paper;
  const cover = input?.cover === undefined ? 'softcover' : input.cover;
  if (typeof paper !== 'string' || !Object.hasOwn(PAPER_SHEET_TYPES, paper)) throw new PricingError('invalid_paper', 'יש לבחור סוג נייר');
  if (!vendorFinishForCover(cover)) {
    throw new PricingError('cover_not_available', 'כריכה זו אינה זמינה להזמנה');
  }
  const pageCount = input?.pageCount ?? PRINT_PAGE_COUNT;
  const settings = getPricingSettings(env);

  if (settings.marginAgorot > MAX_AGOROT || settings.shipAgorot > MAX_AGOROT || settings.maxQty < 1 || settings.maxQty > MAX_QTY) throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');

  const product = PRINT_PRODUCTS.find((p) => p.presetId === presetId);
  if (!product) throw new PricingError('unknown_preset', 'גודל הדפסה לא מוכר');
  if (!isSupportedPageCount(pageCount)) {
    throw new PricingError('invalid_page_count', 'מספר העמודים אינו תקין להדפסה');
  }
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > settings.maxQty) {
    throw new PricingError('invalid_qty', `אפשר להזמין בין 1 ל-${settings.maxQty} עותקים`);
  }
  if (method !== 'ship' && method !== 'pickup') {
    throw new PricingError('invalid_method', 'שיטת המסירה אינה תקינה');
  }
  if (method === 'pickup' && !settings.pickupEnabled) {
    throw new PricingError('pickup_not_available', 'איסוף עצמי אינו זמין כרגע');
  }

  // quoteRef must identify independently confirmed supplier evidence for this
  // exact size, pages, stock, cover, quantity (or evidenced interval) and per-copy price; cost includes VAT.
  // Estimates and interpolation never authorize a sale.
  let quotes = [];
  if (env.PRINT_VERIFIED_QUOTES_JSON) {
    try { quotes = JSON.parse(env.PRINT_VERIFIED_QUOTES_JSON); } catch { throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת'); }
    if (!Array.isArray(quotes)) throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
  }
  const candidates = quotes.filter(q => q && q.presetId === presetId && q.pageCount === pageCount && q.paper === paper && q.cover === cover);
  const matching = candidates.filter(q => {
    const hasQty = q.qty !== undefined;
    const hasRange = q.minQty !== undefined || q.maxQty !== undefined;
    if ((hasQty && hasRange) ||
        (hasQty && (!Number.isSafeInteger(q.qty) || q.qty < 1)) ||
        (hasRange && (!Number.isSafeInteger(q.minQty) || !Number.isSafeInteger(q.maxQty) || q.minQty < 1 || q.maxQty < q.minQty))) {
      throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
    }
    if (hasQty) return qty === q.qty;
    if (hasRange) return qty >= q.minQty && qty <= q.maxQty;
    return qty === 1; // A quote without explicit quantity evidence covers one copy only.
  });
  if (matching.length > 1) throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
  const configured = matching[0];
  if (configured && (!Number.isSafeInteger(configured.costAgorot) || configured.costAgorot < 1 || typeof configured.quoteRef !== 'string' || !configured.quoteRef.trim())) {
    throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');
  }
  // The sole historical vendor quote: white 110, 22×22, 24 pages.
  const historical = cover === 'softcover' && paper === 'standard' && presetId === 'square-220' && pageCount === PRINT_PAGE_COUNT;
  if (paper === 'standard' && !historical && !configured && !settings.allowUnverified) throw new PricingError('size_not_available', 'הגודל הזה עדיין אינו זמין להזמנה');
  const estimate = cover === 'softcover' && paper === 'standard' && settings.allowUnverified ? STANDARD_ESTIMATES[presetId]?.[(pageCount - 24) / 4] : undefined;
  if (!configured && !historical && estimate === undefined) throw new PricingError('price_unavailable', 'מחיר ההדפסה לא זמין כרגע');
  const costPerCopy = configured ? configured.costAgorot : historical ? 2466 : estimate;
  const verified = Boolean(configured || historical);
  const unitAgorot = ceilToWholeIls(costPerCopy + settings.marginAgorot);
  if (!Number.isSafeInteger(unitAgorot) || unitAgorot > MAX_AGOROT || unitAgorot * qty + (method === 'ship' ? settings.shipAgorot : 0) > MAX_AGOROT) throw new PricingError('config_invalid', 'הגדרת מחיר שגויה בשרת');

  const lines = [
    {
      key: 'book',
      label_he: qty > 1 ? `ספר מודפס × ${qty}` : 'ספר מודפס',
      amountAgorot: unitAgorot * qty,
    },
  ];
  if (method === 'ship') {
    lines.push({ key: 'shipping', label_he: 'משלוח סיפוראי', amountAgorot: settings.shipAgorot });
  } else {
    lines.push({ key: 'shipping', label_he: 'איסוף עצמי', amountAgorot: 0 });
  }
  const totalAgorot = lines.reduce((sum, l) => sum + l.amountAgorot, 0);

  return {
    currency: 'ILS',
    presetId,
    paper,
    cover,
    sheettype: PAPER_SHEET_TYPES[paper],
    quoteRef: configured?.quoteRef || (historical ? 'historical-22x22-24-white110' : 'bookpod-production-cost-estimate-2026-11-18'),
    qty,
    method,
    lines,
    totalAgorot,
    vatIncluded: true,
    vatAgorot: vatIncludedAgorot(totalAgorot),
    unitAgorot,
    pageCount,
    verified,
    priceVersion: PRICE_VERSION,
  };
}
