import React, { useEffect } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import { updateMeta, resetMeta } from '@/lib/seo';
import HeroSection from '@/components/landing/HeroSection';
import StatsSection from '@/components/landing/StatsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import WhyUsSection from '@/components/landing/WhyUsSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import PricingSection from '@/components/landing/PricingSection';
import FAQChat from '@/components/landing/FAQChat';
import CTASection from '@/components/landing/CTASection';
import FooterSection from '@/components/landing/FooterSection';
import { useI18n } from '@/components/i18n/i18nProvider';

const LandingPage = () => {
  const { t, isRTL } = useI18n();

  useEffect(() => {
    updateMeta({
      title: t('landing.meta.title'),
      description: t('landing.meta.description'),
    });
    return () => resetMeta();
  }, [t]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <LandingNav />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <ShowcaseSection />
      <WhyUsSection />
      <HowItWorksSection />
      <PricingSection />
      <FAQChat />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default LandingPage;
