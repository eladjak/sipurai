import { useI18n } from '@/components/i18n/i18nProvider';
import { Link } from 'react-router-dom';
import { isPrintOrderEnabled } from '@/lib/printOrder/flag';

/** "Order a printed book" entry point. Renders nothing at all unless the feature flag is on. */
export function OrderBookButton({ bookId }) {
  const { t } = useI18n();
  if (!isPrintOrderEnabled() || !bookId) return null;
  return (
    <Link
      to={`/book/${bookId}/order`}
      className="inline-flex min-h-11 items-center rounded-xl bg-purple-600 px-4 text-sm font-bold text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
    >
      {t('print.checkoutPage.orderBook')}
    </Link>
  );
}
