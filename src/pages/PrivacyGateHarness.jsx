// Dev-only screenshot harness for the privacy gate (VITE_PRIVACY_HARNESS=1). Not part of a normal build.
// /__privacy-gate?state=empty|missing|filled|saving|error|loading|loaderror|success|delete|delete-error&lang=he|en
// owner-list|owner-unshare|owner-delete|owner-delete-error|owner-delete-busy|cancel-signedout|cancel-active|cancel-confirm|cancel-error|cancel-none|cancel-done|footer
// add &returning=1 to see the "policy was updated" variant of the consent screen
import { useSearchParams } from 'react-router-dom';
import ConsentScreen, { GateLoadError, GateLoading, GateSuccess } from '@/components/privacy/ConsentScreen';
import DeleteAccountCard from '@/components/settings/DeleteAccountCard';
import AccountDataControls from '@/components/settings/AccountDataControls';
import AvatarSelector from '@/components/profile/AvatarSelector';
import { BookControlButton } from '@/components/bookControls/BookControls';
import CancelSubscription from '@/pages/CancelSubscription';
import FooterSection from '@/components/landing/FooterSection';

export default function PrivacyGateHarness() {
  const [params] = useSearchParams();
  const state = params.get('state') || 'empty';
  const lang = params.get('lang') === 'en' ? 'en' : 'he';
  const isRTL = lang === 'he';
  const noop = () => {};

  if (state.startsWith('owner-')) {
    const book = { id: 'demo', title: 'דוב והירח', is_public: true };
    const pending = () => new Promise(() => {});
    const open = state !== 'owner-list';
    const kind = state === 'owner-unshare' ? 'unshare' : 'delete';
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-md space-y-2 bg-gray-50 p-4">
        {state === 'owner-list' ? (<><BookControlButton kind="unshare" book={book} /><BookControlButton kind="delete" book={book} /></>) : (
          <BookControlButton
            key={state}
            kind={kind}
            book={book}
            initialOpen={open}
            initialError={state === 'owner-delete-error' ? 'המחיקה לא הושלמה. אפשר ללחוץ שוב. אם זה חוזר, כתבו ל-support@sipurai.ai.' : ''}
            onAction={state === 'owner-delete-busy' ? pending : undefined}
          />
        )}
      </div>
    );
  }
  if (state.startsWith('cancel-')) {
    const st = state.slice(7);
    const map = { signedout: { status: 'signedOut' }, active: { status: 'active', plan: 'premium' }, confirm: { status: 'active', plan: 'premium', confirmOpen: true }, error: { status: 'active', plan: 'premium', confirmOpen: true, error: 'הביטול לא הושלם, ולא בוטל כלום. אפשר ללחוץ שוב, או לשלוח לנו מייל ונבטל בשבילכם.' }, none: { status: 'none' }, done: { status: 'done' } };
    return <CancelSubscription initial={map[st] || map.signedout} />;
  }
  if (state === 'footer') return <FooterSection />;
  if (state === 'delete-off') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl bg-gray-50 p-4">
        <AccountDataControls language={lang === 'en' ? 'english' : 'hebrew'} isRTL={isRTL} enabled={false} />
      </div>
    );
  }
  if (state === 'avatar') return <AvatarSelector open onOpenChange={noop} currentAvatar="" onSelectAvatar={noop} />;
  if (state === 'loading') return <GateLoading lang={lang} isRTL={isRTL} />;
  if (state === 'loaderror') return <GateLoadError lang={lang} isRTL={isRTL} onRetry={noop} onSignOut={noop} />;
  if (state === 'success') return <GateSuccess lang={lang} isRTL={isRTL} />;
  if (state === 'delete' || state === 'delete-error') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl bg-gray-50 p-4">
        <DeleteAccountCard
          language={lang === 'en' ? 'english' : 'hebrew'}
          isRTL={isRTL}
          initialOpen={params.get('open') !== '0'}
          initialError={state === 'delete-error' ? (lang === 'he' ? 'יש לכם מנוי בתשלום פעיל. מחיקת החשבון לא מבטלת חיוב, ולכן צריך קודם לבטל את המנוי. אחרי הביטול אפשר למחוק.' : 'You have an active paid subscription. Deleting the account does not stop billing, so please cancel the subscription first. Then you can delete.') : ''}
          onDelete={() => new Promise(() => {})}
        />
      </div>
    );
  }
  return (
    <ConsentScreen
      lang={lang}
      isRTL={isRTL}
      status={state === 'saving' ? 'saving' : state === 'error' ? 'error' : 'idle'}
      returning={params.get('returning') === '1'}
      initialChecks={(() => {
        const on = state === 'filled' || state === 'saving' || state === 'error';
        return { guardian: on, privacy: on, terms: on };
      })()}
      initialShowMissing={state === 'missing'}
      onAccept={noop}
      onDecline={noop}
    />
  );
}
