/**
 * Public /pricing route — exposes the existing PricingSection landing component
 * as a stand-alone page so marketing/footer/social can deep-link to it.
 *
 * Created 2026-05-08 night per Sipurai audit gap #1 (no public pricing page).
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PricingSection from '@/components/landing/PricingSection';
import { useI18n } from '@/components/i18n/i18nProvider';

export default function Pricing() {
  const { t, isRTL } = useI18n();

  useEffect(() => {
    document.title = `${t('landing.pricing.sectionTitle') || 'תמחור'} · Sipurai`;
  }, [t]);

  const heading = t('landing.pricing.heading') || t('landing.pricing.sectionTitle') || (isRTL ? 'מסלולים פשוטים, ערך גדול' : 'Simple plans, big value');
  const subheading = t('landing.pricing.subheading') || t('landing.pricing.sectionSubtitle') || (isRTL ? 'התחילו חינם, שדרגו כשהילדים יוצרים יותר.' : 'Start free, upgrade as you go.');
  const guaranteeNote = t('landing.pricing.guaranteeNote') || (isRTL ? 'ניתן לבטל מתי שרוצים. החיוב מתבצע בדולרים, התצוגה בש״ח להתמצאות בלבד.' : 'Cancel any time. Charged in USD, NIS shown for reference.');
  const haveQuestions = t('common.haveQuestions') || (isRTL ? 'יש שאלות? דברו איתנו' : 'Questions? Get in touch');
  const homeLabel = t('common.home') || (isRTL ? 'דף הבית' : 'Home');

  return (
    <main
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50 pb-16 pt-8 md:pt-12"
    >
      <div className="max-w-5xl mx-auto px-4">
        <header className="mb-8 text-center">
          <Link
            to="/"
            className="text-sm text-purple-700 hover:text-purple-900 underline"
          >
            ← {homeLabel}
          </Link>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold text-slate-900">
            {heading}
          </h1>
          <p className="mt-2 text-slate-600 text-base md:text-lg">
            {subheading}
          </p>
        </header>

        <PricingSection />

        <section className="mt-12 max-w-2xl mx-auto text-center text-sm text-slate-500">
          <p>{guaranteeNote}</p>
          <p className="mt-3">
            <Link to="/contact" className="text-purple-700 hover:text-purple-900 underline">
              {haveQuestions}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
