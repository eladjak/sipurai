import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/components/i18n/i18nProvider';
import { acceptConsent, fetchConsentStatus, CURRENT_POLICY_VERSION } from '@/lib/privacyConsent';
import ConsentScreen, { GateLoadError, GateLoading, GateSuccess } from './ConsentScreen';

const SUCCESS_MS = 900;

/**
 * Stands in front of the whole app. A signed-in parent who has not accepted the CURRENT policy
 * version sees the consent screen and nothing else. If we cannot find out (server error), the app
 * stays closed and offers a retry: not knowing is not consent.
 * `enabled` is false on legal/marketing/sign-in pages, which anyone may open.
 */
export default function PrivacyGate({ enabled, children }) {
  const { user, logout } = useAuth();
  const { language, isRTL } = useI18n();
  const lang = language === 'english' ? 'en' : 'he';
  const qc = useQueryClient();
  const active = !!enabled && !!user?.id;
  const key = ['privacy-consent', user?.id, CURRENT_POLICY_VERSION];

  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchConsentStatus(),
    enabled: active,
    retry: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [status, setStatus] = useState('idle');
  const [errorText, setErrorText] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!active) return children;
  if (q.isPending) return <GateLoading lang={lang} isRTL={isRTL} />;
  if (q.isError) return <GateLoadError lang={lang} isRTL={isRTL} onRetry={() => q.refetch()} onSignOut={() => logout()} />;
  if (celebrate) return <GateSuccess lang={lang} isRTL={isRTL} />;
  if (q.data?.hasConsent) return children;

  const accept = async () => {
    setStatus('saving');
    setErrorText('');
    try {
      await acceptConsent({ locale: lang });
      setStatus('idle');
      setCelebrate(true);
      timer.current = setTimeout(() => {
        qc.setQueryData(key, { hasConsent: true, policyVersion: CURRENT_POLICY_VERSION });
        setCelebrate(false);
      }, SUCCESS_MS);
    } catch (e) {
      setStatus('error');
      setErrorText(e?.code === 'network' ? '' : e?.message && /[֐-׿]/.test(e.message) ? e.message : '');
    }
  };

  return <ConsentScreen lang={lang} isRTL={isRTL} status={status} errorText={errorText} returning={!!q.data?.returning} onAccept={accept} onDecline={() => logout()} />;
}
