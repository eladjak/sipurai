import { useI18n } from '@/components/i18n/i18nProvider';
import { Truck, Store, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatIls } from './format';
import { statusMeta, TONE_CLASSES } from './statusMeta';

export function orderDate(iso, language) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locales = { hebrew: 'he-IL', english: 'en-US' };
  return date.toLocaleDateString(locales[language] || 'he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function translatedStatus(t, status) {
  const meta = statusMeta(status);
  const translations = {
    'print.orderStatuses.awaiting_payment.label': t('print.orderStatuses.awaiting_payment.label'),
    'print.orderStatuses.awaiting_payment.hint': t('print.orderStatuses.awaiting_payment.hint'),
    'print.orderStatuses.paid.label': t('print.orderStatuses.paid.label'),
    'print.orderStatuses.paid.hint': t('print.orderStatuses.paid.hint'),
    'print.orderStatuses.submitting.label': t('print.orderStatuses.submitting.label'),
    'print.orderStatuses.submitting.hint': t('print.orderStatuses.submitting.hint'),
    'print.orderStatuses.submitted.label': t('print.orderStatuses.submitted.label'),
    'print.orderStatuses.submitted.hint': t('print.orderStatuses.submitted.hint'),
    'print.orderStatuses.in_production.label': t('print.orderStatuses.in_production.label'),
    'print.orderStatuses.in_production.hint': t('print.orderStatuses.in_production.hint'),
    'print.orderStatuses.shipped.label': t('print.orderStatuses.shipped.label'),
    'print.orderStatuses.shipped.hint': t('print.orderStatuses.shipped.hint'),
    'print.orderStatuses.ready_for_pickup.label': t('print.orderStatuses.ready_for_pickup.label'),
    'print.orderStatuses.ready_for_pickup.hint': t('print.orderStatuses.ready_for_pickup.hint'),
    'print.orderStatuses.cancelled.label': t('print.orderStatuses.cancelled.label'),
    'print.orderStatuses.cancelled.hint': t('print.orderStatuses.cancelled.hint'),
    'print.orderStatuses.failed_needs_attention.label': t('print.orderStatuses.failed_needs_attention.label'),
    'print.orderStatuses.failed_needs_attention.hint': t('print.orderStatuses.failed_needs_attention.hint'),
    'print.orderStatuses.unknown.label': t('print.orderStatuses.unknown.label'),
  };
  return { label: translations[meta.labelKey], hint: translations[meta.hintKey] || '' };
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const meta = statusMeta(status);
  return (
    <span className={cn('inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold ring-1 ring-inset', TONE_CLASSES[meta.tone])} data-status={status}>
      {String(translatedStatus(t, status).label)}
    </span>
  );
}

/** One order, as the customer sees it. */
export function OrderCard({ order }) {
  const { t, language } = useI18n();
  const meta = statusMeta(order.status);
  const Icon = order.method === 'pickup' ? Store : Truck;
  return (
    <li className="rounded-3xl border border-purple-100/80 bg-white p-4 shadow-[0_8px_30px_rgba(124,58,237,0.08)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-extrabold leading-snug text-slate-900 dark:text-white">{order.bookTitle || String(t('print.orderDetails.myBook'))}</h2>
        <StatusBadge status={order.status} />
      </div>
      {meta.hintKey && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{String(translatedStatus(t, order.status).hint || '')}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">{String(t('print.orderDetails.copies'))}</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{order.qty}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">{String(t('print.orderDetails.total'))}</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr" style={{ textAlign: 'right' }}>
            {formatIls(order.totalAgorot)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">{String(t('print.orderDetails.method'))}</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            <Icon className="h-4 w-4 text-purple-600" aria-hidden="true" />
            {order.method === 'pickup' ? String(t('print.orderDetails.pickup')) : String(t('print.orderDetails.delivery'))}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">{String(t('print.orderDetails.ordered'))}</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{orderDate(order.createdAt, language)}</dd>
        </div>
      </dl>
      {order.trackingUrl && (
        <a
          href={order.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-purple-50 px-4 text-sm font-bold text-purple-800 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {String(t('print.orderDetails.tracking'))}
        </a>
      )}
    </li>
  );
}
