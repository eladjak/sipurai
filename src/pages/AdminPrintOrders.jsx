import { useI18n } from '@/components/i18n/i18nProvider';
import { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, RefreshCw, Send, PackageCheck, Truck, XCircle, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { printOrderApi } from '@/lib/printOrder/api';
import { PageShell, InlineAlert, SecondaryButton, PrimaryButton } from '@/components/checkout/ui';
import { StatusBadge, translatedStatus, orderDate } from '@/components/checkout/OrderCard';
import { ORDER_STATUSES } from '@/components/checkout/statusMeta';
import { formatIls } from '@/components/checkout/format';

/** Which actions make sense for which order. The server is the real judge; this only avoids pointless buttons. */
export function allowedActions(o) {
  const done = ['cancelled', 'shipped', 'ready_for_pickup'].includes(o.status);
  const unpaid = o.status === 'awaiting_payment';
  return {
    retry_submit: ['paid', 'submitting', 'failed_needs_attention'].includes(o.status),
    mark_ready_for_pickup: o.method === 'pickup' && !done && !unpaid,
    mark_shipped: o.method === 'ship' && !done && !unpaid,
    cancel: !['cancelled', 'shipped', 'ready_for_pickup'].includes(o.status),
  };
}

const ACTIONS = [
  { id: 'retry_submit', labelKey: 'print.adminOrders.retry_submit', Icon: Send },
  { id: 'mark_ready_for_pickup', labelKey: 'print.adminOrders.mark_ready_for_pickup', Icon: PackageCheck },
  { id: 'mark_shipped', labelKey: 'print.adminOrders.mark_shipped', Icon: Truck },
  { id: 'cancel', labelKey: 'print.adminOrders.cancel', Icon: XCircle, danger: true },
];

function addressLine(a, t) {
  if (!a || typeof a !== 'object') return '';
  const street = [a.street, a.houseNumber].filter(Boolean).join(' ');
  return [a.fullName, [street, a.apartment && t('print.orderDetails.apartment', { apartment: a.apartment })].filter(Boolean).join(', '), a.city, a.phone].filter(Boolean).join(' · ');
}

function AdminOrderCard({ order, api, onChanged }) {
  const { t, language } = useI18n();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [result, setResult] = useState(null);
  const allowed = allowedActions(order);

  const run = async (action) => {
    setBusy(action);
    setResult(null);
    try {
      await api.adminAction({ id: order.id, action, note: note.trim() || undefined });
      setResult({ ok: true, text: String(t('print.adminOrders.success')) });
      setConfirmCancel(false);
      setNote('');
      onChanged();
    } catch (e) {
      setResult({ ok: false, text: String(language === 'hebrew' && e.message_he ? e.message_he : (e.code === 'unauthorized' ? t('print.checkoutPage.unauthorized') : e.code === 'forbidden' ? t('print.checkoutPage.forbidden') : t('print.adminOrders.actionError'))) });
    } finally {
      setBusy(null);
    }
  };

  const noteId = `note-${order.id}`;
  return (
    <li className="rounded-3xl border border-purple-100/80 bg-white p-4 shadow-[0_8px_30px_rgba(124,58,237,0.08)] dark:border-slate-800 dark:bg-slate-900" data-testid="admin-order">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-snug text-slate-900 dark:text-white">{order.bookTitle || String(t('print.orderDetails.untitled'))}</h2>
          <p className="mt-0.5 text-xs text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>
            {order.id}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500">{String(t('print.orderDetails.copies'))}</dt>
          <dd className="font-semibold">{order.qty}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{String(t('print.orderDetails.total'))}</dt>
          <dd className="font-semibold tabular-nums" dir="ltr" style={{ textAlign: 'right' }}>
            {formatIls(order.totalAgorot)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{String(t('print.orderDetails.method'))}</dt>
          <dd className="font-semibold">{order.method === 'pickup' ? String(t('print.orderDetails.pickup')) : String(t('print.orderDetails.delivery'))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{String(t('print.orderDetails.orderedPaid'))}</dt>
          <dd className="font-semibold">
            {orderDate(order.createdAt, language)}
            {order.paidAt ? ` / ${orderDate(order.paidAt, language)}` : ` / ${t('print.orderDetails.unpaid')}`}
          </dd>
        </div>
      </dl>

      {(order.address || order.userEmail || order.userId) && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {addressLine(order.address, t)}
          {order.userEmail && <span className="block" dir="ltr" style={{ textAlign: 'right' }}>{order.userEmail}</span>}
        </p>
      )}
      {order.lastError && (
        <p className="mt-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <strong>{String(t('print.adminOrders.lastError'))}</strong>
          {String(order.lastError)}
        </p>
      )}

      <div className="mt-4">
        <label htmlFor={noteId} className="mb-1 block text-sm font-bold">
          {String(t('print.adminOrders.note'))}{' '}<span className="text-xs font-normal text-slate-500">{String(t('print.adminOrders.noteHint'))}</span>
        </label>
        <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder={String(t('print.adminOrders.notePlaceholder'))} className="rounded-2xl text-base" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ACTIONS.map(({ id, Icon, danger }) => {
          const on = allowed[id];
          if (id === 'cancel' && confirmCancel) return null;
          return (
            <button
              key={id}
              type="button"
              disabled={!on || busy !== null}
              onClick={() => (id === 'cancel' ? setConfirmCancel(true) : run(id))}
              className={cn(
                'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-[opacity,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-40',
                danger ? 'border-rose-200 text-rose-800 hover:bg-rose-50' : 'border-purple-200 text-purple-900 hover:bg-purple-50'
              )}
              data-action={id}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {busy === id ? String(t('print.adminOrders.working')) : String(({ retry_submit: t('print.adminOrders.retry_submit'), mark_ready_for_pickup: t('print.adminOrders.mark_ready_for_pickup'), mark_shipped: t('print.adminOrders.mark_shipped'), cancel: t('print.adminOrders.cancel') })[id])}
            </button>
          );
        })}
      </div>

      {confirmCancel && (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alertdialog" aria-label={String(t('print.adminOrders.cancelLabel'))} data-testid="cancel-confirm">
          <p className="font-bold">{String(t('print.adminOrders.cancelQuestion'))}</p>
          <p className="mt-0.5">{String(t('print.adminOrders.cancelHint'))}</p>
          <div className="mt-2 flex gap-2">
            <PrimaryButton type="button" className="h-11 flex-1 bg-rose-700 hover:bg-rose-800" onClick={() => run('cancel')} loading={busy === 'cancel'} disabled={busy !== null}>
              {String(t('print.adminOrders.cancelYes'))}
            </PrimaryButton>
            <SecondaryButton type="button" className="h-11 flex-1" onClick={() => setConfirmCancel(false)} disabled={busy !== null}>
              {String(t('print.adminOrders.cancelNo'))}
            </SecondaryButton>
          </div>
        </div>
      )}

      <p className={cn('mt-2 min-h-5 text-sm font-medium', result?.ok ? 'text-emerald-700' : 'text-rose-700')} role="status" aria-live="polite">
        {result?.text || ''}
      </p>
    </li>
  );
}

export function AdminPrintOrdersView({ api = printOrderApi }) {
  const { t, language } = useI18n();
  const [status, setStatus] = useState('');
  const [state, setState] = useState({ phase: 'loading', orders: [], alerts: [], error: null });

  const load = useCallback(async (silent) => {
    if (silent !== true) setState((s) => ({ ...s, phase: 'loading', error: null }));
    try {
      const res = await api.adminList(status || undefined);
      setState({ phase: 'ready', orders: res.orders || [], alerts: res.alerts || [], error: null });
    } catch (error) {
      setState({ phase: error.status === 403 || error.code === 'forbidden' ? 'forbidden' : 'error', orders: [], alerts: [], error });
    }
  }, [api, status]);

  useEffect(() => {
    load();
  }, [load]);

  const alertText = (a) => (typeof a === 'string' ? a : a?.message_he || a?.text || String(t('print.adminOrders.alertFallback')));

  return (
    <PageShell title={String(t('print.adminOrders.title'))} subtitle={String(t('print.adminOrders.subtitle'))} backTo={createPageUrl('Home')} backLabel={String(t('print.adminOrders.back'))} wide>
      {state.phase === 'forbidden' && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center" data-testid="admin-403">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
          <h2 className="mt-2 text-xl font-extrabold text-amber-950">{String(t('print.adminOrders.forbidden'))}</h2>
          <p className="mx-auto mt-1 max-w-sm text-base leading-relaxed text-amber-900">
            {String(t('print.adminOrders.forbiddenHint'))}
          </p>
        </div>
      )}

      {state.phase !== 'forbidden' && (
        <>
          {state.alerts.length > 0 && (
            <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-950" role="alert" data-testid="admin-alerts">
              <p className="flex items-center gap-2 text-base font-extrabold">
                <BellRing className="h-5 w-5" aria-hidden="true" />
                {state.alerts.length === 1 ? String(t('print.adminOrders.alertOne')) : String(t('print.adminOrders.alertMany', { count: state.alerts.length }))}
              </p>
              <ul className="mt-2 list-inside list-disc text-sm leading-relaxed">
                {state.alerts.map((a, i) => (
                  <li key={i}>{alertText(a)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="status-filter" className="mb-1 block text-sm font-bold">
                {String(t('print.adminOrders.filter'))}
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-12 min-w-48 rounded-2xl border border-slate-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-slate-900"
              >
                <option value="">{String(t('print.adminOrders.all'))}</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {String(translatedStatus(t, s).label)}
                  </option>
                ))}
              </select>
            </div>
            <SecondaryButton type="button" onClick={load}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {String(t('print.adminOrders.refresh'))}
            </SecondaryButton>
          </div>

          {state.phase === 'loading' && (
            <ul className="grid gap-4 md:grid-cols-2" aria-busy="true" role="status" aria-label={String(t('print.adminOrders.loading'))}>
              {[0, 1].map((i) => (
                <li key={i} className="rounded-3xl border border-purple-100 bg-white p-4">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="mt-3 h-20 w-full" />
                  <Skeleton className="mt-3 h-12 w-full" />
                </li>
              ))}
            </ul>
          )}

          {state.phase === 'error' && (
            <InlineAlert title={String(t('print.adminOrders.error'))} onRetry={load}>
              {/** @type {any} */ (language === 'hebrew' && state.error?.message_he ? state.error.message_he : (state.error?.code === 'unauthorized' ? t('print.checkoutPage.unauthorized') : t('print.checkoutPage.generic')))}
            </InlineAlert>
          )}

          {state.phase === 'ready' && state.orders.length === 0 && (
            <div className="rounded-3xl border border-dashed border-purple-200 bg-white/80 p-8 text-center" data-testid="admin-empty">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
              <p className="mt-2 text-lg font-bold">{String(t('print.adminOrders.empty'))}</p>
              <p className="text-sm text-slate-600">{String(t('print.adminOrders.emptyHint'))}</p>
            </div>
          )}

          {state.phase === 'ready' && state.orders.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2" data-testid="admin-list">
              {state.orders.map((o) => (
                <AdminOrderCard key={o.id} order={o} api={api} onChanged={() => load(true)} />
              ))}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}

export default function AdminPrintOrders() {
  return <AdminPrintOrdersView />;
}
