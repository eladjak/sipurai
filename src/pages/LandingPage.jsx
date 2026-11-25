import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function focusSection(id) {
  const heading = document.getElementById(id)?.querySelector('h2');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
}

const LandingPage = () => {
  const { t, isRTL } = useI18n();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { if (hash) focusSection(hash.slice(1)); }, [hash]);

  const handleAnchor = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href^="#"]');
    const targetHash = anchor?.getAttribute('href') || '';
    const id = targetHash.slice(1);
    if (!id || !document.getElementById(id)?.querySelector('h2')) return;
    event.preventDefault();
    if (targetHash === hash) focusSection(id);
    else navigate({ pathname, search, hash: targetHash }, { preventScrollReset: true });
  };

  useEffect(() => {
    updateMeta({
      title: t('landing.meta.title'),
      description: t('landing.meta.description'),
    });
    return () => resetMeta();
  }, [t]);

  return (
    <div onClick={handleAnchor} className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden [&_section_h2]:scroll-mt-24" dir={isRTL ? 'rtl' : 'ltr'}>
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
