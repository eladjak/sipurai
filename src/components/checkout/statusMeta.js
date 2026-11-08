/** Customer-facing wording and colour for each order status. The print vendor is never named. */
export const STATUS_META = {
  awaiting_payment: { label: 'ממתינה לתשלום', tone: 'amber', hint: 'ההזמנה נשמרה. ההדפסה מתחילה רק אחרי אישור התשלום.' },
  paid: { label: 'שולם, מתכוננים להדפסה', tone: 'blue', hint: 'התשלום התקבל. אנחנו מכינים את הספר להדפסה.' },
  submitting: { label: 'מעבירים להדפסה', tone: 'blue', hint: 'הספר בדרך לדפוס.' },
  submitted: { label: 'הועברה להדפסה', tone: 'blue', hint: 'ספק ההדפסה קיבל את הספר שלך.' },
  in_production: { label: 'בהדפסה', tone: 'purple', hint: 'הספר שלך מודפס ומוכן בימים אלה.' },
  shipped: { label: 'נשלחה אליך', tone: 'green', hint: 'הספר בדרך אליך.' },
  ready_for_pickup: { label: 'מוכנה לאיסוף', tone: 'green', hint: 'הספר מוכן לאיסוף.' },
  cancelled: { label: 'בוטלה', tone: 'gray', hint: 'ההזמנה בוטלה.' },
  failed_needs_attention: { label: 'דורשת טיפול שלנו', tone: 'red', hint: 'נתקלנו בבעיה בהעברה להדפסה. ההזמנה שמורה ואנחנו מטפלים בזה.' },
};

export const ORDER_STATUSES = Object.keys(STATUS_META);

/** Statuses from which the payment is known to have arrived. */
export const PAID_OR_LATER = ['paid', 'submitting', 'submitted', 'in_production', 'shipped', 'ready_for_pickup'];

export const TONE_CLASSES = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800',
  purple: 'bg-purple-50 text-purple-800 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:ring-purple-800',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  red: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800',
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: 'בטיפול', tone: 'gray', hint: '' };
}
