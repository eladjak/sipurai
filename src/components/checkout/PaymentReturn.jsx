import { useI18n } from '@/components/i18n/i18nProvider';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SuccessBookArt, WaitingPrinterArt } from './Illustrations';
import { InlineAlert } from './ui';
import { PAID_OR_LATER } from './statusMeta';

const STOP = ['submitted', 'in_production', 'shipped', 'ready_for_pickup', 'cancelled', 'failed_needs_attention'];

/**
 * Shown on /orders?paid=1. Polls the order until the payment is confirmed and the order
 * is handed to printing, with friendly wording for every in-between state.
 */
export function PaymentReturn({ api, orderId, pollMs = 3000, maxMs = 120000, onStatusChange }) {
  const { t } = useI18n();
  const [order, setOrder] = useState(null);
  const [slow, setSlow] = useState(false);
  const [softError, setSoftError] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const started = Date.now();
    let timer;
    let fails = 0;
    const tick = async () => {
      try {
        let o;
        if (orderId) {
          o = await api.getOrder(orderId);
        } else {
          const { orders } = await api.getMyOrders();
          o = [...(orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
        }
        if (stopped.current) return;
        fails = 0;
        setSoftError(false);
        if (o) {
          setOrder((prev) => {
            if (prev?.status !== o.status && onStatusChange) setTimeout(() => onStatusChange(o), 0);
            return o;
          });
        }
        if (o && STOP.includes(o.status)) return;
      } catch {
        fails += 1;
        if (!stopped.current && fails >= 2) setSoftError(true);
      }
      if (stopped.current) return;
      if (Date.now() - started > maxMs) {
        setSlow(true);
        return;
      }
      timer = setTimeout(tick, pollMs);
    };
    tick();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
   
  }, [api, orderId, pollMs, maxMs]);

  const status = order?.status;
  const paid = status && PAID_OR_LATER.includes(status);

  if (status === 'failed_needs_attention') {
    return (
      <InlineAlert tone="warn" title={t('print.checkoutCopy.returnFailed')} className="mb-5">
        {t('print.checkoutCopy.returnFailedHint')}
      </InlineAlert>
    );
  }
  if (status === 'cancelled') {
    return (
      <InlineAlert tone="info" title={t('print.checkoutCopy.cancelled')} className="mb-5">
        {t('print.checkoutCopy.cancelledHint')}
      </InlineAlert>
    );
  }

  if (paid) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="mb-5 rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-5 text-center dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-900"
        role="status"
        aria-live="polite"
        data-testid="payment-success"
      >
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2, delay: 0.05 }} className="mx-auto w-fit">
          <SuccessBookArt />
        </motion.div>
        <h2 className="mt-2 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">{t('print.checkoutCopy.success')}</h2>
        <p className="mt-1 text-base leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
          {STOP.includes(status) ? t('print.checkoutCopy.sent') : t('print.checkoutCopy.sending')}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="mb-5 rounded-3xl border border-purple-100 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900" role="status" aria-live="polite" data-testid="payment-checking">
      <div className="mx-auto w-fit">
        <WaitingPrinterArt />
      </div>
      <h2 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">{t('print.checkoutCopy.checking')}</h2>
      <p className="mt-1 text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {slow
          ? t('print.checkoutCopy.slow')
          : softError
            ? t('print.checkoutCopy.connection')
            : t('print.checkoutCopy.waiting')}
      </p>
    </div>
  );
}
