/** Order state machine. Every status change goes through canTransition(). */

export const STATUSES = Object.freeze([
  'awaiting_payment', 'paid', 'submitting', 'submitted', 'in_production',
  'shipped', 'ready_for_pickup', 'cancelled', 'failed_needs_attention',
]);

const TRANSITIONS = {
  awaiting_payment: ['paid', 'cancelled', 'failed_needs_attention'],
  // paid -> paid is not a transition; "paid" is also where a vendor_disabled submit lands again.
  paid: ['submitting', 'ready_for_pickup', 'failed_needs_attention'],
  submitting: ['submitted', 'paid', 'failed_needs_attention'],
  submitted: ['in_production', 'shipped', 'ready_for_pickup', 'failed_needs_attention'],
  in_production: ['shipped', 'ready_for_pickup', 'failed_needs_attention'],
  failed_needs_attention: ['submitting', 'cancelled'],
  shipped: [],
  ready_for_pickup: [],
  cancelled: ['failed_needs_attention'], // only used when money arrives for a cancelled order
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** All statuses from which `to` may be entered (used for atomic compare-and-set). */
export function allowedFrom(to) {
  return STATUSES.filter((s) => canTransition(s, to));
}

export const STATUS_LABEL_HE = Object.freeze({
  awaiting_payment: 'ממתין לתשלום',
  paid: 'שולם, ההזמנה בטיפול',
  submitting: 'ההזמנה עוברת להדפסה',
  submitted: 'ההזמנה התקבלה להדפסה',
  in_production: 'הספר בהדפסה',
  shipped: 'נשלח אליך',
  ready_for_pickup: 'מוכן לאיסוף',
  cancelled: 'בוטל',
  failed_needs_attention: 'ההזמנה בטיפול אצלנו',
});

export const TERMINAL = Object.freeze(['shipped', 'ready_for_pickup', 'cancelled']);
