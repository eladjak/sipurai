import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { BookOpen } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const SignIn = () => {
  const { isRTL } = useI18n();
  const [searchParams] = useSearchParams();

  // Read redirect_url from query string, validate it's a relative path
  const rawRedirect = searchParams.get('redirect_url') || '/';
  const afterSignInUrl = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-800 px-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <BookOpen className="h-8 w-8 text-white" />
        <span className="text-2xl font-bold text-white">Sipurai</span>
      </Link>

      {/* Clerk Sign In Component */}
      <ClerkSignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={afterSignInUrl}
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-2xl rounded-2xl',
          }
        }}
      />
    </div>
  );
};

export default SignIn;
