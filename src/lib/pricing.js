/**
 * Single source of truth for what price a visitor sees and whether they can pay.
 *
 * Israeli visitors see shekels (Consumer Protection Law s.17D); everyone else
 * sees US dollars. Pure module: no React, safe to unit test.
 */

// USD = live Creem products (Creem only supports USD/EUR).
// ILS = PROPOSED price points awaiting owner approval (same numbers already shown publicly).
export const PRICE_POINTS = {
  USD: { free: 0, lite: 3.9, premium: 7.9, family: 9.9 },
  ILS: { free: 0, lite: 14.9, premium: 29, family: 39 },
};


export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

// The server-reported country (when known) decides; language and time zone are only the
// fallback for an unknown country (not loaded yet, failed, or no geo header).
export function resolveCurrency({ country, language, timeZone } = {}) {
  const c = String(country || '').toUpperCase();
  if (c) return c === 'IL' ? 'ILS' : 'USD';
  // Country unknown (lookup failed, timed out, or no geo header): fail closed to shekels, so an
  // Israeli is never shown a dollar price. The server refuses checkout for unknown country too.
  // language/timeZone are kept in the signature for callers but no longer decide.
  void language; void timeZone;
  return 'ILS';
}

function amountText(amount) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function formatPrice(planId, currency) {
  const table = PRICE_POINTS[currency] || PRICE_POINTS.USD;
  const amount = table[planId] ?? 0;
  return currency === 'ILS' ? `${amountText(amount)} ₪` : `$${amountText(amount)}`;
}

// Becomes true only when a real shekel payment provider is wired in. There is none today,
// and no flag may route Israeli visitors into the USD Creem checkout.
export function isIlsCheckoutOpen() {
  return false;
}

export function canCheckout(currency) {
  return currency === 'USD' ? true : isIlsCheckoutOpen();
}
