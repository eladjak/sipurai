import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Globe, Menu, X, LayoutDashboard, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useAuth } from '@/lib/AuthContext';

/* Wordmark letters for the staggered logo entrance/hover wave.
   LTR order enforced by `.logo-anim { direction: ltr }` (bidi gotcha #2). */
const WORDMARK_LETTERS = ['S', 'i', 'p', 'u', 'r', 'a', 'i'];

const LandingNav = () => {
  const { t, isRTL, language, changeLanguage, languages } = useI18n();
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navLinks = [
    { href: '#features', label: t('landing.nav.features') },
    { href: '#how-it-works', label: t('landing.nav.howItWorks') },
    { href: '#pricing', label: t('landing.nav.pricing') },
    { href: '/blog', label: t('landing.footer.blog'), isRoute: true },
  ];

  const languageOptions = Object.entries(languages).map(([key, lang]) => ({
    key,
    name: lang.name,
    code: lang.code,
  }));

  const scrollToSection = (e, href) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md'
          : 'bg-transparent'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — staggered letters + icon tilt (logo-animation-pattern.md) */}
          <Link to="/" aria-label="Sipurai - Go to homepage" className="flex items-center gap-2">
            <BookOpen className={`logo-icon-anim h-8 w-8 text-purple-600 ${scrolled ? '' : 'text-white'}`} aria-hidden="true" />
            <span className={`text-xl font-bold ${scrolled ? 'text-gray-900 dark:text-white' : 'text-white'}`}>
              <span className="sr-only">Sipurai</span>
              <span className="logo-anim" aria-hidden="true">
                {WORDMARK_LETTERS.map((ch, i) => (
                  <span key={i} className="logo-anim__ch" style={{ '--i': i }}>
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors hover:text-purple-600 flex items-center gap-1.5 ${
                    scrolled ? 'text-gray-700 dark:text-gray-300' : 'text-white/90 hover:text-white'
                  }`}
                >
                  <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className={`text-sm font-medium transition-colors hover:text-purple-600 ${
                    scrolled ? 'text-gray-700 dark:text-gray-300' : 'text-white/90 hover:text-white'
                  }`}
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          {/* Right Side: Language + CTA */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <div className="relative group" ref={langDropdownRef}>
              <button
                onClick={() => setLangDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={langDropdownOpen}
                aria-label={t('nav.changeLanguage') || 'Change language'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  scrolled
                    ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>{languages[language]?.name}</span>
              </button>
              <div
                role="menu"
                className={`absolute end-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border transition-all duration-200 min-w-[140px] ${
                  langDropdownOpen
                    ? 'opacity-100 visible'
                    : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                }`}
              >
                {languageOptions.map((lang) => (
                  <button
                    key={lang.key}
                    role="menuitem"
                    onClick={() => {
                      changeLanguage(lang.key);
                      setLangDropdownOpen(false);
                    }}
                    className={`block w-full text-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                      language === lang.key
                        ? 'text-purple-600 font-medium bg-purple-50 dark:bg-purple-900/20'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {isAuthenticated ? (
              /* Logged-in: show Go to App button */
              <Link to="/">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {t('landing.nav.goToApp')}
                </Button>
              </Link>
            ) : (
              <>
                {/* Sign In */}
                <Link to="/sign-in">
                  <Button variant="ghost" className={`font-medium ${
                    scrolled ? 'text-gray-700 hover:text-purple-600 dark:text-gray-300' : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}>
                    {t('landing.nav.signIn')}
                  </Button>
                </Link>
                {/* CTA Button */}
                <Link to="/sign-up">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg">
                    {t('landing.nav.cta')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg ${
              scrolled ? 'text-gray-700 dark:text-gray-300' : 'text-white'
            }`}
            aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          id="mobile-menu"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-white dark:bg-gray-900 border-t shadow-lg"
        >
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-700 dark:text-gray-300 hover:text-purple-600"
                >
                  <Newspaper className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="block py-2 text-gray-700 dark:text-gray-300 hover:text-purple-600"
                >
                  {link.label}
                </a>
              )
            )}
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex gap-2">
              {languageOptions.map((lang) => (
                <button
                  key={lang.key}
                  onClick={() => {
                    changeLanguage(lang.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    language === lang.key
                      ? 'bg-purple-100 text-purple-700 font-medium dark:bg-purple-900/30 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            {isAuthenticated ? (
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2 flex items-center justify-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {t('landing.nav.goToApp')}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full mt-2">
                    {t('landing.nav.signIn')}
                  </Button>
                </Link>
                <Link to="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-1">
                    {t('landing.nav.cta')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default LandingNav;
