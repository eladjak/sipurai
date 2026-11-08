/** Israeli address validation + normalisation. Pure. */

const clean = (v, max) =>
  String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, '')
    .trim()
    .slice(0, max);

const PHONE_RE = /^(?:\+972[-\s]?|0)5\d[-\s]?\d{7}$/;
const HOUSE_RE = /^\d{1,4}[A-Za-zא-ת]?$/;
const ZIP_RE = /^\d{7}$/;

/** "050-1234567", "+972 50 1234567", "0501234567" -> "050-1234567" */
export function normalizePhone(raw) {
  const s = clean(raw, 20);
  if (!PHONE_RE.test(s)) return null;
  const digits = s.replace(/[^\d]/g, '').replace(/^972/, '0');
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/**
 * @param {object|null} input
 * @param {'ship'|'pickup'} method
 * @returns {{ok:true,address:object}|{ok:false,errors:Record<string,string>}}
 */
export function validateAddress(input, method) {
  const a = input && typeof input === 'object' ? input : {};
  const errors = {};

  const fullName = clean(a.fullName, 80);
  if (fullName.length < 2) errors.fullName = 'נא למלא שם מלא';

  const phone = normalizePhone(a.phone);
  if (!phone) errors.phone = 'מספר טלפון נייד לא תקין, למשל 050-1234567';

  const out = { fullName, phone };

  if (method === 'ship') {
    const city = clean(a.city, 60);
    const street = clean(a.street, 80);
    const houseNumber = clean(a.houseNumber, 8);
    if (city.length < 2) errors.city = 'נא למלא עיר';
    if (street.length < 2) errors.street = 'נא למלא רחוב';
    if (!HOUSE_RE.test(houseNumber)) errors.houseNumber = 'נא למלא מספר בית, למשל 12 או 12א';
    out.city = city;
    out.street = street;
    out.houseNumber = houseNumber;

    const apartment = clean(a.apartment, 10);
    if (apartment) out.apartment = apartment;
    const zip = clean(a.zip, 10);
    if (zip) {
      if (!ZIP_RE.test(zip)) errors.zip = 'מיקוד בן 7 ספרות, או להשאיר ריק';
      else out.zip = zip;
    }
  }
  const notes = clean(a.notes, 200);
  if (notes) out.notes = notes;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, address: out };
}
