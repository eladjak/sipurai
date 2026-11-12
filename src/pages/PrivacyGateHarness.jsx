// Dev-only screenshot harness for the privacy gate (VITE_PRIVACY_HARNESS=1). Not part of a normal build.
// /__privacy-gate?state=empty|missing|filled|saving|error|loading|loaderror|success|delete|delete-error&lang=he|en
// add &returning=1 to see the "policy was updated" variant of the consent screen
import { useSearchParams } from 'react-router-dom';
import ConsentScreen, { GateLoadError, GateLoading, GateSuccess } from '@/components/privacy/ConsentScreen';
import DeleteAccountCard from '@/components/settings/DeleteAccountCard';
import AccountDataControls from '@/components/settings/AccountDataControls';
import AvatarSelector from '@/components/profile/AvatarSelector';

export default function PrivacyGateHarness() {
  const [params] = useSearchParams();
  const state = params.get('state') || 'empty';
  const lang = params.get('lang') === 'en' ? 'en' : 'he';
  const isRTL = lang === 'he';
  const noop = () => {};

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
