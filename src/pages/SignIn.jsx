import { safeAuthReturn, authLink } from "@/lib/authReturn";
import { isNewShell } from '@/lib/flags';
import { Wordmark } from '@/components/brand/Wordmark';
import { clerkAppearance } from '@/shell/clerkAppearance';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { Link, useSearchParams } from 'react-router-dom';

const SignIn = () => {
  const { isRTL, language, t } = useI18n();
  const [searchParams] = useSearchParams();

  // Read redirect_url from query string, validate it's a relative path
  const rawRedirect = searchParams.get('redirect_url') || '/';
  const afterSignInUrl = safeAuthReturn(rawRedirect);
  const signUpUrl = authLink('/sign-up', afterSignInUrl);

  if (isNewShell()) {
    return (
      <main className="sp-shell flex min-h-screen flex-col items-center justify-center bg-sp-paper px-4 py-10 font-sp-body text-sp-ink-900" dir={isRTL ? 'rtl' : 'ltr'}>
        <Link to="/" className="inline-flex min-h-12 items-center rounded-[var(--sp-r-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600">
          <Wordmark language={language === 'english' ? 'en' : 'he'} />
        </Link>
        <p className="mb-7 mt-4 text-center text-sp-ink-600">{t('auth.reassurance')}</p>
        <ClerkSignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} forceRedirectUrl={afterSignInUrl} fallbackRedirectUrl={afterSignInUrl} appearance={clerkAppearance} />
      </main>
    );
  }

  return (
    <main className="sp-shell flex min-h-screen flex-col items-center justify-center bg-[#f8f1e3] px-4 py-10 text-[#202b3c]" dir={isRTL ? 'rtl' : 'ltr'}>
      <Link to="/" className="inline-flex min-h-12 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"><Wordmark language={language === 'english' ? 'en' : 'he'} /></Link>
      <p className="mb-7 mt-4 text-center">{t('auth.reassurance')}</p>
      <ClerkSignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} forceRedirectUrl={afterSignInUrl} fallbackRedirectUrl={afterSignInUrl} appearance={{ elements: { rootBox: 'mx-auto', card: 'shadow-2xl rounded-2xl' } }} />
    </main>
  );
};

export default SignIn;
