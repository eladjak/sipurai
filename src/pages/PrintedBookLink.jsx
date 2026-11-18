import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Wordmark } from '@/components/brand/Wordmark';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useAuth } from '@/lib/AuthContext';
import { isNewShell } from '@/lib/flags';
import { supabase } from '@/lib/supabaseClient';
import { toAppImageUrl } from '@/lib/imageUrl';
import { resolvePrintedBook } from '@/lib/printedBookLink';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';

export default function PrintedBookLink() {
  const { id } = useParams();
  const { user, isLoadingAuth } = useAuth();
  const { t, language, isRTL } = useI18n();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const identity = user?.id || '';
  useEffect(() => {
    if (isLoadingAuth) return;
    let current = true;
    resolvePrintedBook(supabase, id, identity).catch(() => ({kind: 'error'})).then(value => {
      if (current) setResult({ id, identity, attempt, value });
    });
    return () => { current = false; };
  }, [id, identity, isLoadingAuth, attempt]);

  const value = !isLoadingAuth && result?.id === id && result.identity === identity && result.attempt === attempt
    ? result.value : { kind: 'loading' };
  const reader = '/BookView?id=' + encodeURIComponent(id);
  if (value.kind === 'owner') return <Navigate replace to={reader} />;
  const shared = value.kind === 'shared';
  const picture = (shared && toAppImageUrl(value.book.cover_image)) || '/images/spx/hearth.webp';
  const primary = 'inline-flex min-h-12 items-center justify-center rounded-full bg-sp-violet-700 px-6 font-semibold text-white focus-visible:outline focus-visible:outline-offset-4';
  const secondary = 'inline-flex min-h-12 items-center px-2 font-semibold text-sp-violet-700 underline underline-offset-4';
  return <main dir={isRTL ? 'rtl' : 'ltr'} className="sp-shell min-h-screen bg-sp-paper px-5 py-8 font-sp-body text-sp-ink-900 sm:py-14">
    <div className="mx-auto max-w-4xl">
      <Link className="inline-flex min-h-12 items-center" to="/"><Wordmark language={language === 'english' ? 'en' : 'he'} /></Link>
      <div className="mt-8 grid items-center gap-7 sm:mt-14 sm:grid-cols-2 sm:gap-12">
        <img alt="" src={picture} className="aspect-square w-full rounded-2xl object-cover shadow-md" />
        <div aria-live="polite">
          {value.kind === 'loading' ? <p role="status">{t('common.loading')}</p> : <>
            <h1 className="font-sp-display text-3xl font-semibold leading-tight sm:text-5xl">{shared ? value.book.title : value.kind === 'error' ? t('printedLink.errorTitle') : t('printedLink.privateTitle')}</h1>
            <p className="my-5 max-w-prose text-lg leading-relaxed">{shared ? value.book.description || t('printedLink.shared') : value.kind === 'error' ? t('printedLink.errorBody') : t('printedLink.privateBody')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {shared && <Link className={primary} to={reader}>{t('printedLink.read')}</Link>}
              {value.kind === 'error' && <button type="button" className={secondary} onClick={() => setAttempt(n => n + 1)}>{t('printedLink.retry')}</button>}
              <Link className={shared ? secondary : primary} to={identity ? (isNewShell() ? '/new' : '/BookWizard') : '/sign-in?redirect_url=' + encodeURIComponent(isNewShell() ? '/new' : '/BookWizard')}>{t('printedLink.create')}</Link>
              <Link className={secondary} to="/samples/demo-dragons-garden">{t('spxLibrary.readSample')}</Link>
              {!identity && <Link className={secondary} to={'/sign-in?redirect_url=' + encodeURIComponent('/b/print/' + id)}>{t('printedLink.owner')}</Link>}
            </div>
          </>}
        </div>
      </div>
    </div>
  </main>;
}
