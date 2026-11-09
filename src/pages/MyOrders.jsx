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

export function MyOrdersView({ api = printOrderApi, paid = false, cancelled = false, orderId, paymentId, pollMs, maxPollMs }) {
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
    <PageShell title="ההזמנות שלי" subtitle="הספרים המודפסים שהזמנתם, ובאיזה שלב כל אחד נמצא." backTo={createPageUrl('Library')} backLabel="לספרייה">
      {cancelled && (
        <InlineAlert tone="info" title="התשלום בוטל, ולא חויבתם" className="mb-5">
          ההזמנה נשמרה. אפשר לחזור לספר ולהזמין שוב מתי שנוח.
        </InlineAlert>
      )}
      {paid && <PaymentReturn api={api} orderId={orderId} paymentId={paymentId} pollMs={pollMs} maxMs={maxPollMs} onStatusChange={() => load(true)} />}

      {state.status === 'loading' && (
        <ul className="space-y-4" aria-busy="true" aria-label="טוענים את ההזמנות" role="status">
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
        <InlineAlert title="לא הצלחנו לטעון את ההזמנות" onRetry={() => load()}>
          {state.error?.message_he || 'משהו השתבש. נסו שוב בעוד רגע.'}
        </InlineAlert>
      )}

      {state.status === 'ready' && state.orders.length === 0 && (
        <div className="rounded-3xl border border-dashed border-purple-200 bg-white/80 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900" data-testid="orders-empty">
          <div className="mx-auto w-fit">
            <EmptyOrdersArt />
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">עדיין לא הזמנתם ספר מודפס</h2>
          <p className="mx-auto mt-1 max-w-xs text-base leading-relaxed text-slate-600 dark:text-slate-300">
            פתחו ספר שהכנתם ולחצו על "להזמין ספר מודפס". כך הוא יגיע אליכם כספר אמיתי, עם דפים לדפדף בהם.
          </p>
          <Link
            to={createPageUrl('Library')}
            className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-purple-600 px-6 text-base font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            לספרים שלי
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
              רענון הסטטוס
            </SecondaryButton>
          </div>
        </>
      )}
    </PageShell>
  );
}

export default function MyOrders() {
  const [sp] = useSearchParams();
  return (
    <MyOrdersView
      paid={sp.get('paid') === '1'}
      cancelled={sp.get('cancelled') === '1'}
      orderId={sp.get('order') || sp.get('orderId') || undefined}
      paymentId={sp.get('OG-PaymentID') || undefined}
    />
  );
}
