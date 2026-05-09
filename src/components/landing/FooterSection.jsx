import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Heart, Mail, Twitter, Instagram, Facebook, Youtube } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

const FooterSection = () => {
  const { t, isRTL } = useI18n();

  const links = [
    { label: t('landing.pricing.sectionTitle') || (isRTL ? 'מחירים' : 'Pricing'), href: '/Pricing', external: false },
    { label: t('landing.footer.blog'), href: '/blog', external: false },
    { label: t('landing.footer.privacy'), href: '/privacy', external: false },
    { label: t('landing.footer.terms'), href: '/terms', external: false },
    { label: t('landing.footer.contact'), href: '/Contact', external: false },
  ];

  const socialLinks = [];

  return (
    <footer
      className="bg-gray-900 text-gray-300 py-12 sm:py-16"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Logo + Description */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-7 w-7 text-purple-400" />
              <span className="text-xl font-bold text-white">Sipurai</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              {t('landing.footer.description')}
            </p>
            <a
              href="mailto:support@sipurai.ai"
              className="inline-flex items-center gap-2 mt-3 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Mail className="h-4 w-4" />
              support@sipurai.ai
            </a>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('landing.footer.linksTitle')}</h4>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-purple-400 transition-colors text-sm"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-gray-400 hover:text-purple-400 transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('landing.footer.followUs')}</h4>
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-purple-600 flex items-center justify-center transition-colors duration-200"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Sipurai Playground. {t('landing.footer.rights')}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <p className="text-gray-500 text-sm flex items-center gap-1">
              {t('landing.footer.madeWith')} <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400 inline" /> {t('landing.footer.madeWithEnd')}
            </p>
            <a
              href="https://eladjak.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-purple-400 transition-colors text-xs"
            >
              Created by Elad Yaakobovitch
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
