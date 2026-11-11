import { useI18n } from '@/components/i18n/i18nProvider';
import { ShieldCheck, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIls } from './format';

/** Price lines come ONLY from the server quote. Nothing here is computed on the client. */
export function PriceLines({ quote, loading }) {
  const { t, language } = useI18n();
  if (!quote && loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t('print.checkoutCopy.calculating')}>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }
  if (!quote) return null;
  return (
    <div>
      <ul className="divide-y divide-purple-100 dark:divide-slate-800" data-testid="price-lines">
        {quote.lines.map((l) => (
          <li key={l.key} className="flex items-center justify-between py-2.5 text-base">
            <span className="text-slate-700 dark:text-slate-200">{language === 'english' ? (l.key === 'book' ? (quote.qty > 1 ? t('print.checkoutCopy.bookMany', { qty: quote.qty }) : t('print.checkoutCopy.book')) : l.key === 'shipping' ? (quote.method === 'pickup' ? t('print.checkoutCopy.pickup') : t('print.checkoutCopy.delivery')) : t('print.checkoutCopy.total')) : l.label_he}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr">
              {l.amountAgorot === 0 ? t('print.checkoutCopy.free') : formatIls(l.amountAgorot)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-baseline justify-between border-t-2 border-purple-200 pt-3">
        <span className="text-lg font-extrabold text-slate-900 dark:text-white">{t('print.checkoutCopy.total')}</span>
        <span className="text-2xl font-extrabold tabular-nums text-purple-700 dark:text-purple-300" dir="ltr" data-testid="price-total">
          {formatIls(quote.totalAgorot)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('print.checkoutCopy.finalPrice')}</p>
    </div>
  );
}

export function PaymentNotes() {
  const { t } = useI18n();
  return (
    <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
      <li className="flex items-start gap-2.5">
        <Printer className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" aria-hidden="true" />
        <span>{t('print.checkoutCopy.printNote')}</span>
      </li>
      <li className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" aria-hidden="true" />
        <span>{t('print.checkoutCopy.paymentNote')}</span>
      </li>
    </ul>
  );
}
