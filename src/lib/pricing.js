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

const ILS_TIME_ZONES = ['Asia/Jerusalem', 'Asia/Tel_Aviv'];
const ILS_LANGUAGES = ['hebrew', 'yiddish'];

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export function resolveCurrency({ language, timeZone } = {}) {
  if (ILS_LANGUAGES.includes(language)) return 'ILS';
  if (ILS_TIME_ZONES.includes(timeZone)) return 'ILS';
  return 'USD';
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
