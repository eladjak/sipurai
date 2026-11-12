import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, Mail, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useAuth } from '@/lib/AuthContext';
import { cancelMySubscription, fetchSubscription } from '@/lib/ownerApi';

const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]';

/**
 * /cancel-subscription: public page (required link on the home page, Israeli Consumer Protection Law s.14T).
 * States: signed out · checking · active subscription · none found · check failed · confirming · cancelling · done · cancel failed.
 * The email route is always visible, so nobody is stuck when the online route is unavailable.
 * `initial` lets the screen be tested and photographed without a server.
 */
export default function CancelSubscription({ initial = {} }) {
  const { t, isRTL } = useI18n();
  const { user, isLoadingAuth } = useAuth();
  const [status, setStatus] = useState(initial.status || (user || isLoadingAuth ? 'loading' : 'signedOut'));
  const [plan, setPlan] = useState(initial.plan || '');
  const [confirmOpen, setConfirmOpen] = useState(!!initial.confirmOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial.error || '');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const s = await fetchSubscription();
      setPlan(s?.plan || '');
      setStatus(s?.active ? 'active' : 'none');
    } catch {
      setStatus('statusError');
    }
  }, []);

  useEffect(() => {
    if (initial.status || isLoadingAuth) return;
    if (user) load(); else setStatus('signedOut');
  }, [user, isLoadingAuth, load, initial.status]);

  const cancel = async (e) => {
    e?.preventDefault(); // keep the dialog open until the server answers
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await cancelMySubscription();
      setConfirmOpen(false);
      setStatus('done');
    } catch (err) {
      setError(err?.code === 'network' ? t('cancelSubscription.errorOffline') : t('cancelSubscription.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const mailto = `mailto:support@sipurai.ai?subject=${encodeURIComponent(t('cancelSubscription.mailSubject'))}&body=${encodeURIComponent(t('cancelSubscription.mailBody'))}`;
  const card = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6';

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-dvh bg-gray-50 px-4 py-8 text-gray-900 sm:py-12">
      <div className="mx-auto max-w-xl space-y-5">
        <Link to="/" className="inline-flex min-h-11 items-center text-sm font-medium text-purple-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {t('cancelSubscription.back')}
        </Link>
        <header>
          <h1 className="text-3xl font-bold leading-tight">{t('cancelSubscription.title')}</h1>
          <p className="mt-2 text-base leading-relaxed text-gray-700">{t('cancelSubscription.lead')}</p>
        </header>

        <section aria-labelledby="cs-what" className={card}>
          <h2 id="cs-what" className="flex items-center gap-2 text-lg font-bold"><Clock className="h-5 w-5 text-purple-700" aria-hidden="true" />{t('cancelSubscription.whatTitle')}</h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-gray-800">
            {['what1', 'what2', 'what2b', 'what3'].map((k) => (
              <li key={k} className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />{t(`cancelSubscription.${k}`)}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cs-action" aria-busy={status === 'loading'} className={card}>
          <h2 id="cs-action" className="text-lg font-bold">{t('cancelSubscription.actionTitle')}</h2>

          {status === 'loading' && (
            <p role="status" className="mt-3 flex items-center gap-2 text-gray-700"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{t('cancelSubscription.loading')}</p>
          )}

          {status === 'signedOut' && (
            <div className="mt-3 space-y-3">
              <p className="text-[15px] text-gray-700">{t('cancelSubscription.signedOut')}</p>
              <Link to={`/sign-in?redirect_url=${encodeURIComponent('/cancel-subscription')}`} className={`${btn} border-2 border-purple-300 bg-white text-purple-800 hover:bg-purple-50 focus-visible:ring-purple-500`}>
                {t('cancelSubscription.signIn')}
              </Link>
            </div>
          )}

          {status === 'active' && (
            <div className="mt-3 space-y-3">
              <p className="text-[15px] text-gray-700">{t('cancelSubscription.activeLead')}</p>
              {plan && <p className="text-sm text-gray-600">{t('cancelSubscription.planLabel')}: <span className="font-semibold capitalize text-gray-900">{plan}</span></p>}
              <button type="button" onClick={() => setConfirmOpen(true)} className={`${btn} w-full border-2 border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-500 sm:w-auto`}>
                <XCircle className="h-5 w-5" aria-hidden="true" />{t('cancelSubscription.button')}
              </button>
            </div>
          )}

          {status === 'none' && (
            <p role="status" className="mt-3 rounded-xl bg-gray-50 p-3 text-[15px] text-gray-800">{t('cancelSubscription.noSub')}</p>
          )}

          {status === 'statusError' && (
            <div role="alert" className="mt-3 space-y-3">
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('cancelSubscription.statusError')}</p>
              <button type="button" onClick={load} className={`${btn} border-2 border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus-visible:ring-gray-500`}>{t('cancelSubscription.retry')}</button>
            </div>
          )}

          {status === 'done' && (
            <div role="status" className="mt-3 flex items-start gap-3 rounded-xl bg-green-50 p-4 text-green-900">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
              <div><p className="font-bold">{t('cancelSubscription.doneTitle')}</p><p className="mt-1 text-[15px]">{t('cancelSubscription.doneBody')}</p></div>
            </div>
          )}
        </section>

        <section aria-labelledby="cs-mail" className={card}>
          <h2 id="cs-mail" className="flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-purple-700" aria-hidden="true" />{t('cancelSubscription.mailTitle')}</h2>
          <p className="mt-3 text-[15px] text-gray-800">{t('cancelSubscription.mailLead')}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[15px] text-gray-800">
            {['mail1', 'mail2', 'mail3'].map((k) => <li key={k}>{t(`cancelSubscription.${k}`)}</li>)}
          </ul>
          <a href={mailto} className={`${btn} mt-4 w-full border-2 border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100 focus-visible:ring-purple-500 sm:w-auto`}>
            <Mail className="h-5 w-5" aria-hidden="true" />{t('cancelSubscription.mailButton')}
          </a>
          <p dir="ltr" className="mt-2 text-start text-sm text-gray-600">support@sipurai.ai</p>
          <p className="mt-3 text-[15px] text-gray-800">{t('cancelSubscription.postal')}</p>
        </section>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => { if (!busy) { setConfirmOpen(v); if (!v) setError(''); } }}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl">
          <AlertDialogHeader className={isRTL ? 'sm:text-right' : ''}>
            <AlertDialogTitle className="text-red-700">{t('cancelSubscription.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start text-[15px] leading-relaxed text-gray-700">{t('cancelSubscription.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div role="alert" aria-live="assertive">
            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-12 rounded-xl">{t('cancelSubscription.confirmNo')}</AlertDialogCancel>
            <button type="button" onClick={cancel} disabled={busy} aria-busy={busy} className={`${btn} h-12 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60`}>
              {busy ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('cancelSubscription.busy')}</>) : t('cancelSubscription.confirmYes')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
