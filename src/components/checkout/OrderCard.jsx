import { Truck, Store, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatIls } from './format';
import { statusMeta, TONE_CLASSES } from './statusMeta';

export function StatusBadge({ status, label }) {
  const meta = statusMeta(status);
  return (
    <span className={cn('inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-bold ring-1 ring-inset', TONE_CLASSES[meta.tone])} data-status={status}>
      {label || meta.label}
    </span>
  );
}

/** One order, as the customer sees it. */
export function OrderCard({ order }) {
  const meta = statusMeta(order.status);
  const Icon = order.method === 'pickup' ? Store : Truck;
  return (
    <li className="rounded-3xl border border-purple-100/80 bg-white p-4 shadow-[0_8px_30px_rgba(124,58,237,0.08)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-extrabold leading-snug text-slate-900 dark:text-white">{order.bookTitle || 'הספר שלי'}</h2>
        <StatusBadge status={order.status} label={order.statusLabel_he} />
      </div>
      {meta.hint && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{meta.hint}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">עותקים</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{order.qty}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">סה״כ (כולל מע״מ)</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr" style={{ textAlign: 'right' }}>
            {formatIls(order.totalAgorot)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">קבלה</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            <Icon className="h-4 w-4 text-purple-600" aria-hidden="true" />
            {order.method === 'pickup' ? 'איסוף עצמי' : 'משלוח סיפוראי'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">הוזמן ב</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{formatDate(order.createdAt)}</dd>
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
          מעקב אחרי המשלוח
        </a>
      )}
    </li>
  );
}
