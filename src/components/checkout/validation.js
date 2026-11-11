import hebrewPrint from '@/components/i18n/locales/he/print';

/**
 * Israeli address validation. Every message says what to do, in plain Hebrew,
 * with an example, because it is shown next to the field.
 */
const stripPhone = (s) => String(s || '').replace(/[\s\-()]/g, '');

export const PHONE_RE = /^(?:\+972|972|0)5\d{8}$/;

export function isValidPhone(s) {
  return PHONE_RE.test(stripPhone(s));
}

/** Local mobile numbers are sent as 05X-XXXXXXX, international as +9725XXXXXXXX. */
export function normalizePhone(s) {
  const p = stripPhone(s);
  if (/^05\d{8}$/.test(p)) return `${p.slice(0, 3)}-${p.slice(3)}`;
  if (/^\+?9725\d{8}$/.test(p)) return '+' + p.replace(/^\+/, '');
  return p;
}

export const ADDRESS_FIELDS = ['fullName', 'phone', 'city', 'street', 'houseNumber', 'apartment', 'zip', 'notes'];

export const emptyAddress = () => ({
  fullName: '', phone: '', city: '', street: '', houseNumber: '', apartment: '', zip: '', notes: '',
});

/**
 * @param {Partial<Record<string,string>>} a
 * @param {'ship'|'pickup'} method
 * @returns {Record<string,string>} field -> message (empty object when valid)
 */
export function validateAddress(a, method = 'ship', t = (key) => hebrewPrint.print.validation[key.split('.').pop()]) {
  const errors = {};
  const v = (k) => String(a?.[k] ?? '').trim();
  if (method !== 'ship') return errors;

  if (v('fullName').length < 2 || !/\S+\s+\S+/.test(v('fullName'))) {
    errors.fullName = String(t('print.validation.name'));
  }
  if (!v('phone')) {
    errors.phone = String(t('print.validation.phoneRequired'));
  } else if (!isValidPhone(v('phone'))) {
    errors.phone = String(t('print.validation.phoneInvalid'));
  }
  if (!v('city')) errors.city = String(t('print.validation.city'));
  if (!v('street')) errors.street = String(t('print.validation.street'));
  if (!v('houseNumber')) {
    errors.houseNumber = String(t('print.validation.houseRequired'));
  } else if (!/^\d{1,4}\s?[א-תa-zA-Z]?$/.test(v('houseNumber'))) {
    errors.houseNumber = String(t('print.validation.houseInvalid'));
  }
  if (v('zip') && !/^\d{7}$/.test(v('zip'))) {
    errors.zip = String(t('print.validation.zip'));
  }
  return errors;
}

/** Trim, drop empty optionals, normalise the phone: the shape the server expects. */
export function normalizeAddress(a) {
  const out = {};
  for (const k of ADDRESS_FIELDS) {
    const val = String(a?.[k] ?? '').trim();
    if (val) out[k] = val;
  }
  if (out.phone) out.phone = normalizePhone(out.phone);
  return out;
}
