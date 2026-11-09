/**
 * SUMIT (OfficeGuy) payment adapter for PRINTED-book orders: hosted payment page.
 *
 * Interface (same as the other adapters):
 *   createCheckout(order)                  -> { url, ref }
 *   confirmPayment(order, { paymentId })   -> normalized event | null   (null = not proven paid)
 *   reconcile(orders)                      -> normalized events[]       (payments Summit has but we never heard of)
 *
 * Docs: https://api.sumit.co.il/swagger/v1/swagger.json
 *   POST /billing/payments/beginredirect/  hosted page; returns Data.RedirectURL
 *   POST /billing/payments/get/            Data.Payment { ID, ValidPayment, Amount, Currency, ExternalIdentifier, DocumentID }
 *   POST /billing/payments/list/           Data.Payments[], paged
 *
 * Trust model: Summit's return redirect appends OG-PaymentID / OG-ExternalIdentifier to our
 * RedirectURL and is NOT signed. So the browser is only a courier of a payment id. "Paid" is
 * decided here, by asking Summit with our private key, and requires ALL of:
 *   Status success, ValidPayment true, ExternalIdentifier == this order's id,
 *   Amount == OUR stored total to the agora, Currency ILS.
 * Anything unproven returns null (order stays awaiting_payment). Could not look -> throws.
 *
 * Receipt: Summit issues the receipt itself in the same transaction (DocumentType = Receipt,
 * VAT rate 0: the seller is exempt). One payment -> one document, no second system to sync.
 * Amounts: Summit takes UNITS (108 = 108.00 ILS), our DB stores AGOROT (10800).
 */
import { PaymentError } from './creem.js';

export { PaymentError };

export const DOC_TYPE_RECEIPT = 2; // Accounting_Typed_DocumentType: Receipt (2)
export const SUMMIT_BASE = 'https://api.sumit.co.il';
const SITE = 'https://sipurai.ai';

export const agorotToUnits = (agorot) => {
  if (!Number.isInteger(agorot) || agorot <= 0) throw new PaymentError('bad_amount');
  return Number((agorot / 100).toFixed(2));
};
export const unitsToAgorot = (units) => (typeof units === 'number' && Number.isFinite(units) ? Math.round(units * 100) : null);

const isSuccess = (s) => s === 0 || (typeof s === 'string' && /^success/i.test(s));

export function createSummitPayment({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const base = (env.SUMMIT_API_BASE || SUMMIT_BASE).replace(/\/+$/, '');

  function credentials() {
    const id = Number(env.SUMIT_COMPANY_ID);
    const key = env.SUMIT_API_KEY;
    if (!Number.isInteger(id) || id <= 0 || !key) throw new PaymentError('payment_not_configured');
    return { CompanyID: id, APIKey: key };
  }

  async function api(path, body) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Language': 'he' },
        body: JSON.stringify({ Credentials: credentials(), ...body }),
      });
    } catch (e) {
      throw new PaymentError('payment_unreachable', 'network');
    }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function normalize(order, p) {
    if (!p || p.ValidPayment !== true) return null;
    if (String(p.ExternalIdentifier || '') !== order.id) return null; // payment must be for THIS order
    if (p.Currency != null && !/^(ils|nis|0)$|^(ils|nis)\b|\(0\)/i.test(String(p.Currency))) return null;
    const agorot = unitsToAgorot(p.Amount);
    if (agorot === null) return null;
    return {
      eventId: `summit:${p.ID}`,
      type: 'payment.completed',
      orderId: order.id,
      paymentRef: `summit:${p.ID}`,
      receiptNumber: p.DocumentID ?? null,
      amountAgorot: agorot,
      currency: 'ILS',
    };
  }

  return {
    name: 'summit',

    async createCheckout(order) {
      const amount = agorotToUnits(order.total_agorot); // 10800 agorot -> 108
      const title = 'ספר מודפס מסיפוראי';
      const { ok, status, data } = await api('/billing/payments/beginredirect/', {
        Customer: { Name: order.address?.fullName || 'לקוח סיפוראי', Phone: order.address?.phone || null, SearchMode: 0 },
        Items: [{ Item: { Name: title }, Quantity: 1, UnitPrice: amount }],
        VATIncluded: true,
        VATRate: 0, // exempt dealer (osek patur): no VAT line, ever
        DocumentType: DOC_TYPE_RECEIPT,
        DraftDocument: false,
        DocumentDescription: `הזמנה ${order.id}`,
        ExternalIdentifier: order.id,
        MaximumPayments: 1,
        ExpirationHours: 24,
        PreventSavingPaymentMethod: true,
        Language: 'Hebrew',
        Header: 'סיפוראי',
        RedirectURL: `${SITE}/orders?paid=1&order=${encodeURIComponent(order.id)}`,
        CancelRedirectURL: `${SITE}/orders?cancelled=1&order=${encodeURIComponent(order.id)}`,
      });
      if (!ok) throw new PaymentError('payment_rejected', `status ${status}`);
      if (!isSuccess(data?.Status)) throw new PaymentError('payment_rejected', 'summit business/technical error');
      const url = data?.Data?.RedirectURL;
      if (typeof url !== 'string' || !url.startsWith('https://')) throw new PaymentError('payment_bad_response');
      return { url, ref: `summit:${order.id}` };
    },

    /**
     * @param {{paymentId?: string|number}} p  the OG-PaymentID the browser brought back (untrusted)
     * @returns normalized event, or null when Summit does not prove this order was paid.
     * @throws PaymentError('payment_unreachable') when we could not look (caller retries later).
     */
    async confirmPayment(order, { paymentId } = {}) {
      const id = Number(paymentId);
      if (!Number.isInteger(id) || id <= 0) return null;
      const { ok, status, data } = await api('/billing/payments/get/', { PaymentID: id });
      if (status >= 500) throw new PaymentError('payment_unreachable', `status ${status}`);
      if (!ok || !isSuccess(data?.Status)) return null;
      return normalize(order, data?.Data?.Payment);
    },

    /** Safety net for customers who paid and closed the tab before the return page ran. */
    async reconcile(orders) {
      if (!orders.length) return [];
      const byId = new Map(orders.map((o) => [o.id, o]));
      const oldest = Math.min(...orders.map((o) => new Date(o.created_at).getTime()));
      const from = new Date(oldest - 3600 * 1000).toISOString();
      const events = [];
      for (let start = 0, pages = 0; pages < 5; pages += 1) {
        const r = await api('/billing/payments/list/', { Date_From: from, Valid: true, StartIndex: start });
        if (r.status >= 500) throw new PaymentError('payment_unreachable', `status ${r.status}`);
        if (!r.ok || !isSuccess(r.data?.Status)) throw new PaymentError('payment_unreachable', 'list failed');
        const rows = r.data?.Data?.Payments || [];
        for (const p of rows) {
          const order = byId.get(String(p?.ExternalIdentifier || ''));
          const evt = order && normalize(order, p);
          if (evt) events.push(evt);
        }
        if (!r.data?.Data?.HasNextPage || rows.length === 0) break;
        start += rows.length;
      }
      return events;
    },
  };
}
