import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoonStar } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/components/i18n/i18nProvider';
import { LogoMark } from '@/components/brand/LogoMark';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';

export default function NotFound() {
  const { isAuthenticated } = useAuth();
  const { t, isRTL } = useI18n();

  useEffect(() => {
    const oldTitle = document.title;
    document.title = t('notFound.title');
    const existing = document.querySelector('meta[name="robots"]');
    const oldContent = existing?.getAttribute('content');
    const meta = existing || document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex');
    if (!existing) document.head.appendChild(meta);
    return () => {
      document.title = oldTitle;
      if (!existing) meta.remove();
      else if (oldContent === null) meta.removeAttribute('content');
      else meta.setAttribute('content', oldContent);
    };
  }, [t]);

  const action = 'inline-flex min-h-12 items-center justify-center rounded-[var(--sp-r-sm)] px-6 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sp-gold-400 motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98]';
  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="sp-shell flex min-h-screen flex-col items-center justify-center bg-sp-night-900 px-6 py-12 text-center font-sp-body text-sp-on-night">
      <LogoMark className="h-16 w-16" />
      <MoonStar aria-hidden="true" className="mt-12 h-16 w-16 text-sp-gold-400" strokeWidth={1.25} />
      <h1 className="mt-6 max-w-md font-sp-display text-sp-2xl font-semibold">{t('notFound.title')}</h1>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
        <Link className={`${action} bg-sp-violet-600 text-sp-card hover:bg-sp-violet-700`} to="/">{isAuthenticated ? t('notFound.home') : t('notFound.guestHome')}</Link>
        <Link className={`${action} border border-sp-on-night text-sp-on-night hover:bg-sp-night-700`} to={isAuthenticated ? '/Library' : '/sign-in'}>{isAuthenticated ? t('notFound.shelf') : t('notFound.signIn')}</Link>
      </div>
    </main>
  );
}
