import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';

/** The small, always-findable link required on the home page (Israeli Consumer Protection Law s.14T). */
export default function CancelSubscriptionLink({ className = '' }) {
  const { t } = useI18n();
  return (
    <Link
      to="/cancel-subscription"
      className={`inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
    >
      {t('cancelSubscription.footerLink')}
    </Link>
  );
}
