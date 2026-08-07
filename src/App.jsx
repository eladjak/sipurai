import './App.css'
import { Suspense, useEffect, lazy } from 'react'
import { cleanupStorage } from '@/utils/storageCleanup'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
// VisualEditAgent only loaded in dev — lazy import to keep it out of production bundle
const VisualEditAgent = import.meta.env.DEV
  ? lazy(() => import('@/lib/VisualEditAgent'))
  : () => null;
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, FallbackAuthProvider, useAuth } from '@/lib/AuthContext';
import ClerkLocaleProvider from '@/components/ClerkLocaleProvider';
const SignIn = lazy(() => import('@/pages/SignIn'));
const SignUp = lazy(() => import('@/pages/SignUp'));
import { I18nProvider } from '@/components/i18n/i18nProvider';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { trackPageView } from '@/lib/analytics';
import { initErrorTracking } from '@/lib/errorTracking';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const LandingPage = Pages['LandingPage'];
const Blog = Pages['Blog'];
const BlogPost = Pages['BlogPost'];
const PrivacyPolicy = Pages['PrivacyPolicy'];
const TermsOfService = Pages['TermsOfService'];
const Accessibility = Pages['Accessibility'];

// Pages accessible without authentication (public routes)
const PUBLIC_PAGES = new Set(['BookView', 'LandingPage', 'Blog', 'BlogPost', 'PrivacyPolicy', 'TermsOfService', 'Contact', 'Pricing', 'Accessibility']);

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeInOut' },
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AnimatedPage = ({ children }) => {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'inherit' }}>
      {children}
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const location = useLocation();

  // Track page views on route change
  useEffect(() => {
    const pageName = location.pathname.replace(/^\//, '') || 'Home';
    trackPageView(pageName);
  }, [location.pathname]);

  // Check if the current route is a public page that doesn't need auth
  const currentPath = location.pathname.replace(/^\//, '') || mainPageKey;
  const isPublicRoute =
    PUBLIC_PAGES.has(currentPath) ||
    location.pathname === '/' ||
    location.pathname.startsWith('/blog') ||
    location.pathname.startsWith('/sign-in') ||
    location.pathname.startsWith('/sign-up') ||
    location.pathname === '/privacy' ||
    location.pathname === '/terms' ||
    location.pathname === '/welcome' ||
    location.pathname === '/contact' ||
    location.pathname === '/Contact' ||
    location.pathname === '/pricing' ||
    location.pathname === '/accessibility';

  // Show loading spinner while checking app public settings or auth
  // For public routes, skip auth loading wait (user will be null but that's fine)
  if (!isPublicRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors — but only redirect for non-public routes
  if (!isPublicRoute && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically for protected routes
      navigateToLogin();
      return null;
    }
  }

  // For non-public routes, redirect to login if not authenticated
  if (!isPublicRoute && !isLoadingAuth && !user) {
    navigateToLogin();
    return null;
  }

  // Render the main app
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin"></div>
      </div>
    }>
      <AnimatedPage>
        <Routes location={location}>
          {/* Root: logged-in users see Home dashboard; guests see LandingPage */}
          <Route path="/" element={
            user ? (
              <LayoutWrapper currentPageName={mainPageKey}>
                <MainPage />
              </LayoutWrapper>
            ) : (
              <LandingPage />
            )
          } />
          {/* Landing page always accessible (even when logged in) */}
          <Route path="/welcome" element={<LandingPage />} />
          {/* Auth routes */}
          <Route path="/sign-in/*" element={<SignIn />} />
          <Route path="/sign-up/*" element={<SignUp />} />
          {/* Public blog routes */}
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/accessibility" element={<Accessibility />} />
          {/* All registered pages (auto-generated) — public pages render WITHOUT
              the authenticated LayoutWrapper sidebar. Per Wave-6 audit grok-4. */}
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                PUBLIC_PAGES.has(path) ? (
                  <Page />
                ) : (
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                )
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </AnimatedPage>
    </Suspense>
  );
};


function App() {
  // Run storage cleanup and initialise error tracking once on app startup
  useEffect(() => {
    cleanupStorage();
    initErrorTracking();
  }, []);

  return (
    <ErrorBoundary>
      {/* wow-ui-standard: honor prefers-reduced-motion across ALL framer-motion
          animations app-wide (framer's default is "never"). RM users get
          instant transitions instead of motion. Triple-belt layer 2 (JS). */}
      <MotionConfig reducedMotion="user">
        <I18nProvider>
          <ClerkLocaleProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClientInstance}>
                <Router>
                  <NavigationTracker />
                  <AuthenticatedApp />
                </Router>
                <Toaster />
                {import.meta.env.DEV && <VisualEditAgent />}
              </QueryClientProvider>
            </AuthProvider>
          </ClerkLocaleProvider>
        </I18nProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}

export default App
