import { useI18n } from '@/components/i18n/i18nProvider';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createPageUrl } from '@/utils';
import { printOrderApi } from '@/lib/printOrder/api';
import { PageShell, InlineAlert, SecondaryButton } from '@/components/checkout/ui';
import { OrderCard } from '@/components/checkout/OrderCard';
import { PaymentReturn } from '@/components/checkout/PaymentReturn';
import { EmptyOrdersArt } from '@/components/checkout/Illustrations';

export function MyOrdersView({ api = printOrderApi, paid = false, orderId, pollMs, maxPollMs }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading', orders: [], error: null });

  const load = useCallback(async (silent = false) => {
    if (silent !== true) setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const res = await api.getMyOrders();
      setState({ status: 'ready', orders: res.orders || [], error: null });
    } catch (error) {
      setState({ status: 'error', orders: [], error });
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell title={String(t('print.orders.title'))} subtitle={String(t('print.orders.subtitle'))} backTo={createPageUrl('Library')} backLabel={String(t('print.orders.back'))}>
      {paid && <PaymentReturn api={api} orderId={orderId} pollMs={pollMs} maxMs={maxPollMs} onStatusChange={() => load(true)} />}

      {state.status === 'loading' && (
        <ul className="space-y-4" aria-busy="true" aria-label={String(t('print.orders.loading'))} role="status">
          {[0, 1].map((i) => (
            <li key={i} className="rounded-3xl border border-purple-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-4 h-16 w-full" />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'error' && (
        <InlineAlert title={String(t('print.orders.error'))} onRetry={() => load()}>
          {/** @type {any} */ (state.error?.code === 'network' ? t('print.checkoutPage.network') : t('print.checkoutPage.generic'))}
        </InlineAlert>
      )}

      {state.status === 'ready' && state.orders.length === 0 && (
        <div className="rounded-3xl border border-dashed border-purple-200 bg-white/80 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900" data-testid="orders-empty">
          <div className="mx-auto w-fit">
            <EmptyOrdersArt />
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">{String(t('print.orders.empty'))}</h2>
          <p className="mx-auto mt-1 max-w-xs text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {String(t('print.orders.emptyHint'))}
          </p>
          <Link
            to={createPageUrl('Library')}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-purple-600 px-6 text-base font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            {String(t('print.orders.library'))}
          </Link>
        </div>
      )}

      {state.status === 'ready' && state.orders.length > 0 && (
        <>
          <ul className="space-y-4" data-testid="orders-list">
            {state.orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            <SecondaryButton type="button" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {String(t('print.orders.refresh'))}
            </SecondaryButton>
          </div>
        </>
      )}
    </PageShell>
  );
}

export default function MyOrders() {
  const [sp] = useSearchParams();
  return <MyOrdersView paid={sp.get('paid') === '1'} orderId={sp.get('order') || sp.get('orderId') || undefined} />;
}
