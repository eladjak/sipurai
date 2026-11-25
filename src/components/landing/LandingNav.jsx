import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Globe, LayoutDashboard, Menu, Newspaper, X } from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useAuth } from '@/lib/AuthContext';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600';
const hitArea = `inline-flex min-h-11 min-w-11 items-center rounded-lg ${focusRing}`;

export default function LandingNav() {
  const { t, isRTL, language, changeLanguage, languages } = useI18n();
  const { isAuthenticated } = useAuth();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const langMenu = useRef(null);
  const langTrigger = useRef(null);
  const mobileTrigger = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 1024px)');
    if (!desktop) return;
    const closeDisclosures = () => {
      setMobileMenuOpen(false);
      setLanguagesOpen(false);
    };
    desktop.addEventListener('change', closeDisclosures);
    return () => desktop.removeEventListener('change', closeDisclosures);
  }, []);

  useEffect(() => {
    if (!languagesOpen && !mobileMenuOpen) return;
    const closeOutside = (event) => {
      if (languagesOpen && !langMenu.current?.contains(event.target)) setLanguagesOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      if (languagesOpen) {
        setLanguagesOpen(false);
        langTrigger.current?.focus();
      } else {
        setMobileMenuOpen(false);
        mobileTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [languagesOpen, mobileMenuOpen]);

  const navLinks = [
    { href: '#showcase', label: t('spxLibrary.allSamples') },
    { href: '#features', label: t('landing.nav.features') },
    { href: '#how-it-works', label: t('landing.nav.howItWorks') },
    { href: '#pricing', label: t('landing.nav.pricing') },
    { href: '/blog', label: t('landing.footer.blog'), isRoute: true },
  ];
  const closeMobile = () => setMobileMenuOpen(false);
  const closeAfterAnchor = (event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) closeMobile();
  };

  const renderLinks = (mobile = false) => navLinks.map(({ href, label, isRoute }) => {
    const classes = `${hitArea} gap-1.5 text-gray-800 hover:text-purple-700 dark:text-gray-200 ${mobile ? 'w-full' : 'text-sm font-medium'}`;
    return isRoute ? (
      <Link key={href} to={href} onClick={closeMobile} className={classes}>
        <Newspaper className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    ) : (
      <a key={href} href={href} onClick={closeAfterAnchor} className={classes}>{label}</a>
    );
  });

  const renderLanguages = (mobile = false) => Object.entries(languages).map(([key, locale]) => (
    <button
      key={key}
      type="button"
      aria-pressed={language === key}
      className={`${hitArea} px-3 text-sm ${mobile ? '' : 'w-full'} ${language === key
        ? 'bg-purple-100 font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-100'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
      onClick={() => {
        changeLanguage(key);
        setLanguagesOpen(false);
        setMobileMenuOpen(false);
        (mobile ? mobileTrigger : langTrigger).current?.focus();
      }}
    >
      {locale.name}
    </button>
  ));

  const renderActions = (mobile = false) => {
    const base = `${hitArea} justify-center px-4 text-sm font-medium ${mobile ? 'w-full' : 'whitespace-nowrap'}`;
    const primary = `${base} bg-purple-700 text-white hover:bg-purple-800`;
    if (isAuthenticated) {
      return (
        <Link to="/" onClick={closeMobile} className={`${primary} gap-2`}>
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          {t('landing.nav.goToApp')}
        </Link>
      );
    }
    return (
      <>
        <Link to="/sign-in" onClick={closeMobile} className={`${base} border border-gray-300 text-gray-800 dark:text-gray-200`}>
          {t('landing.nav.signIn')}
        </Link>
        <Link to="/sign-up" onClick={closeMobile} className={primary}>{t('landing.nav.cta')}</Link>
      </>
    );
  };

  return (
    <motion.nav
      initial={reduceMotion ? false : { y: -100 }}
      animate={{ y: 0 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={t('nav.primaryNavigation')}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 motion-reduce:transition-none ${scrolled
        ? 'bg-white/95 shadow-md backdrop-blur-md dark:bg-gray-900/95'
        : 'bg-[#f8f1e3]'}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className={`${hitArea} shrink-0 bg-[#f8f1e3] px-2`} aria-label="Sipurai">
          <Wordmark language={language === 'english' || language === 'en' ? 'en' : 'he'} variant="plate" />
        </Link>
        <div className="hidden items-center gap-3 lg:flex xl:gap-6">{renderLinks()}</div>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div ref={langMenu} className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setLanguagesOpen(false);
          }}>
            <button
              ref={langTrigger}
              type="button"
              aria-expanded={languagesOpen}
              aria-controls="landing-languages"
              aria-label={t('nav.changeLanguage')}
              onClick={() => setLanguagesOpen(open => !open)}
              className={`${hitArea} gap-1.5 px-3 text-sm text-gray-800 hover:bg-black/5 dark:text-gray-200`}
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              {languages[language]?.name}
            </button>
            <div
              id="landing-languages"
              hidden={!languagesOpen}
              className="absolute end-0 top-full mt-1 min-w-[140px] rounded-lg border bg-white p-1 shadow-lg dark:bg-gray-800"
            >
              {renderLanguages()}
            </div>
          </div>
          {renderActions()}
        </div>
        <button
          ref={mobileTrigger}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={() => setMobileMenuOpen(open => !open)}
          className={`${hitArea} justify-center text-gray-800 dark:text-gray-200 lg:hidden`}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
      <div
        id="mobile-menu"
        hidden={!mobileMenuOpen}
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t bg-white px-4 py-4 shadow-lg dark:bg-gray-900 lg:hidden"
      >
        <div className="space-y-1">{renderLinks(true)}</div>
        <hr className="my-3 border-gray-200 dark:border-gray-700" />
        <div className="flex flex-wrap gap-2">{renderLanguages(true)}</div>
        <div className="mt-3 grid gap-2">{renderActions(true)}</div>
      </div>
    </motion.nav>
  );
}
