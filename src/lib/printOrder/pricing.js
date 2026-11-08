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
 *  - Only 22x22cm / 24 pages is backed by a real quote. Every other size uses a
 *    clearly labelled ESTIMATE (`verified:false`) and is orderable only when
 *    PRINT_ALLOW_UNVERIFIED_SIZES === 'true'; otherwise code `size_not_available`.
 */

export const PRICE_VERSION = '2026-11-08.v1';
export const VAT_RATE_PERCENT = 18;
export const DEFAULT_MARGIN_AGOROT = 5434; // 24.66 + 54.34 = 79.00 ILS for the verified size
export const DEFAULT_SHIP_AGOROT = 2900;
export const DEFAULT_MAX_QTY = 10;
export const PRINT_PAGE_COUNT = 24; // the print exporter currently emits exactly 24 pages

/**
 * cost24Agorot: print cost for 24 pages, VAT included.
 * perExtraPageAgorot: ESTIMATE only, used for page counts other than 24.
 * verified: true only where a real vendor quote exists.
 */
export const PRINT_PRODUCTS = Object.freeze([
  Object.freeze({
    presetId: 'square-220',
    label_he: 'ריבוע 22×22 ס"מ',
    cost24Agorot: 2466, // 20.90 + 18% VAT, real quote for a 24-page book
    perExtraPageAgorot: 60,
    verified: true,
  }),
  Object.freeze({
    presetId: 'square-200',
    label_he: 'ריבוע 20×20 ס"מ',
    cost24Agorot: 2300, // ESTIMATE, no real quote yet
    perExtraPageAgorot: 55,
    verified: false,
  }),
  Object.freeze({
    presetId: 'portrait-165x235',
    label_he: 'לאורך 16.5×23.5 ס"מ',
    cost24Agorot: 2400, // ESTIMATE, no real quote yet
    perExtraPageAgorot: 58,
    verified: false,
  }),
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
  return Number(raw);
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
  const pageCount = input?.pageCount ?? PRINT_PAGE_COUNT;
  const settings = getPricingSettings(env);

  const product = PRINT_PRODUCTS.find((p) => p.presetId === presetId);
  if (!product) throw new PricingError('unknown_preset', 'גודל הדפסה לא מוכר');
  if (!Number.isInteger(pageCount) || pageCount < 8 || pageCount > 80 || pageCount % 2 !== 0) {
    throw new PricingError('invalid_page_count', 'מספר העמודים אינו תקין להדפסה');
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > settings.maxQty) {
    throw new PricingError('invalid_qty', `אפשר להזמין בין 1 ל-${settings.maxQty} עותקים`);
  }
  if (method !== 'ship' && method !== 'pickup') {
    throw new PricingError('invalid_method', 'שיטת המסירה אינה תקינה');
  }
  if (method === 'pickup' && !settings.pickupEnabled) {
    throw new PricingError('pickup_not_available', 'איסוף עצמי אינו זמין כרגע');
  }

  const verified = product.verified && pageCount === PRINT_PAGE_COUNT;
  if (!verified && !settings.allowUnverified) {
    throw new PricingError('size_not_available', 'הגודל הזה עדיין אינו זמין להזמנה');
  }

  const costPerCopy = product.cost24Agorot + (pageCount - PRINT_PAGE_COUNT) * product.perExtraPageAgorot;
  const unitAgorot = ceilToWholeIls(costPerCopy + settings.marginAgorot);

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
