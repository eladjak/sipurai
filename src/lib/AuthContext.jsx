import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { User } from '@/entities/User';
import { setUser as setSentryUser } from '@/lib/errorTracking';
import { identifyUser } from '@/lib/analytics';
import { setClerkTokenGetter } from '@/lib/supabaseClient';
import { setApiTokenGetter } from '@/lib/apiAuth';

const AuthContext = createContext();

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Clerk-backed AuthProvider.
 * Must be rendered inside <ClerkProvider>.
 * Keeps the same context shape that the rest of the app expects.
 * Falls back to FallbackAuthProvider when Clerk key is not set.
 */
export const AuthProvider = ({ children }) => {
  if (!HAS_CLERK) return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
};

const ClerkAuthProvider = ({ children }) => {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn, isLoaded: isAuthLoaded, getToken } = useClerkAuth();
  const clerk = useClerk();

  // Connect Clerk JWT to Supabase client so all DB requests are authenticated.
  // This enables RLS policies to use auth.jwt() claims.
  useEffect(() => {
    if (isSignedIn && getToken) {
      setClerkTokenGetter(getToken);
      setApiTokenGetter(getToken);
    } else {
      setClerkTokenGetter(null);
      setApiTokenGetter(null);
    }
    return () => {
      setClerkTokenGetter(null);
      setApiTokenGetter(null);
    };
  }, [isSignedIn, getToken]);

  // Sync the Clerk user to the imperative User module so
  // secureEntity, useGamification, etc. can call User.me().
  useEffect(() => {
    User._setClerkUser(clerkUser || null);

    if (clerkUser) {
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress;
      setSentryUser({ id: clerkUser.id, email });
      identifyUser({ id: clerkUser.id, email });
    } else {
      setSentryUser(null);
    }
  }, [clerkUser]);

  const mappedUser = useMemo(() => {
    if (!clerkUser) return null;
    const meta = clerkUser.unsafeMetadata || {};
    return {
      id: clerkUser.id,
      email:
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress,
      full_name: clerkUser.fullName,
      name: clerkUser.fullName,
      display_name: meta.display_name || clerkUser.firstName || clerkUser.fullName,
      avatar_url: meta.avatar_url || clerkUser.imageUrl,
      role: meta.role || 'user',
      language: meta.language,
      ...meta,
    };
  }, [clerkUser]);

  const value = useMemo(
    () => ({
      user: mappedUser,
      isAuthenticated: !!isSignedIn,
      isLoadingAuth: !isAuthLoaded || !isUserLoaded,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: (shouldRedirect = true) => {
        User.logout();
        if (shouldRedirect) {
          clerk.signOut({ redirectUrl: '/' });
        } else {
          clerk.signOut();
        }
      },
      navigateToLogin: () => {
        // Strip checkout/payment params before encoding redirect URL
        // so post-signup users don't end up seeing stale billing toasts.
        const cleanUrl = (() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('checkout');
            url.searchParams.delete('plan');
            return url.toString();
          } catch {
            return window.location.href;
          }
        })();
        window.location.href = `/sign-in?redirect_url=${encodeURIComponent(cleanUrl)}`;
      },
      checkAppState: () => {},
    }),
    [mappedUser, isSignedIn, isAuthLoaded, isUserLoaded, clerk],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Fallback provider used when VITE_CLERK_PUBLISHABLE_KEY is not set.
 * The app runs without authentication — useful during local development.
 */
export const FallbackAuthProvider = ({ children }) => {
  const value = useMemo(
    () => ({
      user: null,
      isAuthenticated: false,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: () => {},
      navigateToLogin: () => {
        window.location.href = '/';
      },
      checkAppState: () => {},
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
