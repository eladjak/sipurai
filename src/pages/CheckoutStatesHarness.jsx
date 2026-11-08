/**
 * DEV-ONLY screenshot harness. Registered in App.jsx only when
 * VITE_CHECKOUT_HARNESS === '1', so a normal production build contains neither this
 * file nor its route. It renders the REAL screens with fixed fixtures and no Clerk.
 *
 * Open /__checkout-states?state=<name>. See STATES below for the names.
 */
import { useSearchParams } from 'react-router-dom';
import { PrintCheckoutView } from '@/pages/PrintCheckout';
import { MyOrdersView } from '@/pages/MyOrders';
import { AdminPrintOrdersView } from '@/pages/AdminPrintOrders';
import { PrintOrderApiError } from '@/lib/printOrder/api';

const quote = {
  currency: 'ILS',
  presetId: 'sq22',
  qty: 1,
  method: 'ship',
  lines: [
    { key: 'book', label_he: 'ספר מודפס, עותק אחד', amountAgorot: 7900 },
    { key: 'shipping', label_he: 'משלוח סיפוראי', amountAgorot: 2900 },
  ],
  totalAgorot: 10800,
  vatIncluded: true,
};
const pickupQuote = { ...quote, method: 'pickup', lines: [quote.lines[0], { key: 'shipping', label_he: 'איסוף עצמי', amountAgorot: 0 }], totalAgorot: 7900 };

const mk = (id, status, extra = {}) => ({
  id,
  status,
  bookId: 'b1',
  bookTitle: 'המסע של נועה אל הירח',
  presetId: 'sq22',
  qty: 2,
  method: 'ship',
  totalAgorot: 18700,
  createdAt: '2026-11-06T09:00:00Z',
  paidAt: '2026-11-06T09:04:00Z',
  ...extra,
});

const orders = [
  mk('ord_9f3a21', 'in_production'),
  mk('ord_7c10bb', 'ready_for_pickup', { bookTitle: 'דני והדרקון הקטן', qty: 1, method: 'pickup', totalAgorot: 7900 }),
  mk('ord_55d0e4', 'shipped', { bookTitle: 'הגן הסודי של מיכל', trackingUrl: 'https://example.com/track/1' }),
  mk('ord_2a8812', 'awaiting_payment', { paidAt: undefined, qty: 1, totalAgorot: 10800 }),
];

const adminOrders = [
  { ...mk('ord_aa01', 'failed_needs_attention'), address: { fullName: 'דנה לוי', street: 'הנרקיסים', houseNumber: '12', city: 'חיפה', phone: '050-1234567' }, lastError: 'ספק ההדפסה לא הגיב, ננסה שוב' },
  { ...mk('ord_aa02', 'paid', { method: 'pickup', qty: 1, totalAgorot: 7900 }) },
  { ...mk('ord_aa03', 'submitted') },
];

const base = {
  getConfig: async () => ({ enabled: true, pickup: { enabled: true, label_he: 'איסוף עצמי' }, maxQty: 10 }),
  getQuote: async ({ method }) => (method === 'pickup' ? pickupQuote : quote),
  createOrder: async () => ({ orderId: 'ord_new', status: 'awaiting_payment', checkoutUrl: '#harness-pay' }),
  getMyOrders: async () => ({ orders }),
  getOrder: async () => mk('ord_9f3a21', 'submitted'),
  adminList: async () => ({ orders: adminOrders, alerts: [{ message_he: 'ההזמנה של דנה לוי שולמה ולא הועברה להדפסה (ord_aa01)' }] }),
  adminAction: async () => ({ ok: true }),
};
const FILLED = { fullName: 'דנה לוי', phone: '050-1234567', city: 'חיפה', street: 'הנרקיסים', houseNumber: '12', apartment: '4', zip: '3456789' };
const never = () => new Promise(() => {});

const STATES = {
  step1: { kind: 'checkout', step: 1 },
  step2: { kind: 'checkout', step: 2 },
  step3: { kind: 'checkout', step: 3 },
  'step3-creating': { kind: 'checkout', step: 3, api: { createOrder: never } },
  'step3-error': { kind: 'checkout', step: 3, api: { createOrder: async () => { throw new PrintOrderApiError({ code: 'network', message_he: 'אין חיבור לאינטרנט כרגע. בדקו את החיבור ונסו שוב.' }); } } },
  'step3-quote-error': { kind: 'checkout', step: 3, api: { getQuote: async () => { throw new PrintOrderApiError({ code: 'http_500', message_he: 'לא הצלחנו לחשב מחיר כרגע.' }); } } },
  'orders-empty': { kind: 'orders', api: { getMyOrders: async () => ({ orders: [] }) } },
  'orders-list': { kind: 'orders' },
  'orders-loading': { kind: 'orders', api: { getMyOrders: never } },
  'orders-error': { kind: 'orders', api: { getMyOrders: async () => { throw new PrintOrderApiError({ code: 'network', message_he: 'אין חיבור לאינטרנט כרגע. בדקו את החיבור ונסו שוב.' }); } } },
  'after-payment': { kind: 'orders', paid: true, api: { getMyOrders: async () => ({ orders: [mk('ord_9f3a21', 'submitted', { qty: 1, totalAgorot: 10800 })] }), getOrder: async () => mk('ord_9f3a21', 'submitted', { qty: 1 }) } },
  'after-payment-checking': { kind: 'orders', paid: true, api: { getMyOrders: async () => ({ orders: [mk('ord_9f3a21', 'awaiting_payment', { paidAt: undefined })] }), getOrder: async () => mk('ord_9f3a21', 'awaiting_payment', { paidAt: undefined }) } },
  'admin-list': { kind: 'admin' },
  'admin-403': { kind: 'admin', api: { adminList: async () => { throw new PrintOrderApiError({ code: 'forbidden', status: 403, message_he: 'אין הרשאה' }); } } },
};

export default function CheckoutStatesHarness() {
  const [sp] = useSearchParams();
  const name = sp.get('state') || 'step1';
  const cfg = STATES[name];
  if (!cfg) {
    return (
      <div dir="rtl" style={{ padding: 16 }}>
        <p>מצבים זמינים:</p>
        <ul>{Object.keys(STATES).map((k) => <li key={k}><a href={`?state=${k}`}>{k}</a></li>)}</ul>
      </div>
    );
  }
  const api = { ...base, ...(cfg.api || {}) };
  if (cfg.kind === 'checkout') {
    return <PrintCheckoutView key={name} bookId="b1" api={api} initialStep={cfg.step} initialAddress={cfg.step === 3 ? FILLED : undefined} persist={false} quoteDebounceMs={0} redirect={() => {}} />;
  }
  if (cfg.kind === 'orders') return <MyOrdersView key={name} api={api} paid={!!cfg.paid} pollMs={600000} />;
  return <AdminPrintOrdersView key={name} api={api} />;
}
