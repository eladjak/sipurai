/** Customer-facing wording and colour for each order status. The print vendor is never named. */
export const STATUS_META = {
  awaiting_payment: { labelKey: 'print.orderStatuses.awaiting_payment.label', tone: 'amber', hintKey: 'print.orderStatuses.awaiting_payment.hint' },
  paid: { labelKey: 'print.orderStatuses.paid.label', tone: 'blue', hintKey: 'print.orderStatuses.paid.hint' },
  submitting: { labelKey: 'print.orderStatuses.submitting.label', tone: 'blue', hintKey: 'print.orderStatuses.submitting.hint' },
  submitted: { labelKey: 'print.orderStatuses.submitted.label', tone: 'blue', hintKey: 'print.orderStatuses.submitted.hint' },
  in_production: { labelKey: 'print.orderStatuses.in_production.label', tone: 'purple', hintKey: 'print.orderStatuses.in_production.hint' },
  shipped: { labelKey: 'print.orderStatuses.shipped.label', tone: 'green', hintKey: 'print.orderStatuses.shipped.hint' },
  ready_for_pickup: { labelKey: 'print.orderStatuses.ready_for_pickup.label', tone: 'green', hintKey: 'print.orderStatuses.ready_for_pickup.hint' },
  cancelled: { labelKey: 'print.orderStatuses.cancelled.label', tone: 'gray', hintKey: 'print.orderStatuses.cancelled.hint' },
  failed_needs_attention: { labelKey: 'print.orderStatuses.failed_needs_attention.label', tone: 'red', hintKey: 'print.orderStatuses.failed_needs_attention.hint' },
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
  return STATUS_META[status] || { labelKey: 'print.orderStatuses.unknown.label', tone: 'gray', hintKey: null };
}
