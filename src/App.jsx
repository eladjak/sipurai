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
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate, Link } from 'react-router-dom';
import { redirects, resolveRedirect } from './lib/routes';
import { isNewShell } from '@/lib/flags';
import { useI18n } from '@/components/i18n/i18nProvider';
import { EmptyState } from '@/components/ds/EmptyState';
import PageNotFound from './lib/PageNotFound';
import RedirectHome, { LEGACY_HOME_PATHS } from './lib/RedirectHome';
import { AuthProvider, FallbackAuthProvider, useAuth } from '@/lib/AuthContext';
import ClerkLocaleProvider from '@/components/ClerkLocaleProvider';
const SignIn = lazy(() => import('@/pages/SignIn'));
const SignUp = lazy(() => import('@/pages/SignUp'));
// Printed-book ordering. The env test is written inline so that, with the flag off,
// the bundler drops these lazy imports and the screens are not in the build at all.
const PrintCheckout = import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true' ? lazy(() => import('@/pages/PrintCheckout')) : null;
const MyOrders = import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true' ? lazy(() => import('@/pages/MyOrders')) : null;
const AdminPrintOrders = import.meta.env.VITE_PRINT_ORDER_ENABLED === 'true' ? lazy(() => import('@/pages/AdminPrintOrders')) : null;
// Dev-only screenshot harness (never present in a normal build).
const CheckoutHarness = import.meta.env.VITE_CHECKOUT_HARNESS === '1' ? lazy(() => import('@/pages/CheckoutStatesHarness')) : null;
const PrivacyGateHarness = import.meta.env.VITE_PRIVACY_HARNESS === '1' ? lazy(() => import('@/pages/PrivacyGateHarness')) : null;
import { I18nProvider } from '@/components/i18n/i18nProvider';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import PrivacyGate from '@/components/privacy/PrivacyGate';
import { isGateExempt } from '@/lib/privacyConsent';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { trackPageView } from '@/lib/analytics';
import { initErrorTracking } from '@/lib/errorTracking';

const NewAppShell = import.meta.env.VITE_NEW_SHELL === 'true' ? lazy(() => import('@/shell/AppShell')) : null;
const NewNotFound = import.meta.env.VITE_NEW_SHELL === 'true' ? lazy(() => import('@/screens/notfound/NotFound')) : null;
const UiGallery = (import.meta.env.DEV || import.meta.env.VITE_UI_GALLERY === '1') && import.meta.env.VITE_NEW_SHELL === 'true' ? lazy(() => import('@/pages/UiGallery')) : null;

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

// This branch is reachable only in builds with the phase-one switch enabled.
const NewShellRoutes = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();
  const { t } = useI18n();
  useEffect(() => { trackPageView(location.pathname.replace(/^\//, '') || 'Home'); }, [location.pathname]);
  const shell = (Page) => <NewAppShell><Page /></NewAppShell>;
  const protectedPage = (Page) => {
    if (isLoadingAuth || isLoadingPublicSettings) return <div role="status" aria-label={t('common.loading')} />;
    if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (!user) return <Navigate replace to={`/sign-in?redirect_url=${encodeURIComponent(location.pathname + location.search + location.hash)}`} />;
    return shell(Page);
  };
  const Help = () => <EmptyState title={t('shell.help')} action={<Link className="inline-flex min-h-12 items-center rounded-sp-sm px-4 text-sp-violet-700 hover:underline focus-visible:outline focus-visible:outline-2" to="/help/contact">{t('common.contact')}</Link>} quietAction={<Link className="inline-flex min-h-12 items-center rounded-sp-sm px-4 text-sp-violet-700 hover:underline focus-visible:outline focus-visible:outline-2" to="/help/accessibility">{t('common.accessibilityStatement')}</Link>} />;
  return <Suspense fallback={<div role="status" aria-label={t('common.loading')} />}><PrivacyGate enabled={!!user && !isGateExempt(({ '/help/contact': '/contact', '/help/accessibility': '/accessibility' })[location.pathname] || location.pathname) && !(PrivacyGateHarness !== null && location.pathname === '/__privacy-gate')}><Routes location={location}>
    {Object.keys(redirects).map(from => <Route caseSensitive key={from} path={from} element={<Navigate replace to={resolveRedirect(from, location.search, location.hash)} />} />)}
    <Route path="/" element={user ? shell(MainPage) : <LandingPage />} />
    <Route path="/welcome" element={<LandingPage />} />
    <Route path="/sign-in/*" element={<SignIn />} /><Route path="/sign-up/*" element={<SignUp />} />
    <Route path="/blog" element={<Blog />} /><Route path="/blog/:slug" element={<BlogPost />} />
    <Route path="/privacy" element={<PrivacyPolicy />} /><Route path="/terms" element={<TermsOfService />} />
    <Route path="/pricing" element={<Pages.Pricing />} />
    <Route path="/help/contact" element={<Pages.Contact />} /><Route path="/help/accessibility" element={<Accessibility />} />
    <Route path="/shelf" element={protectedPage(Pages.Library)} /><Route path="/heroes" element={protectedPage(Pages.Characters)} />
    <Route path="/parents" element={protectedPage(Pages.Settings)} /><Route path="/new" element={protectedPage(Pages.BookWizard)} />
    <Route path="/help" element={protectedPage(Help)} />
    {['BookView', 'CharacterEditor', 'CommunityPost', 'BookCreation', 'Feedback', 'Leaderboard', 'Community'].map(name => <Route key={name} path={`/${name}`} element={protectedPage(Pages[name])} />)}
    <Route path="/BlogPost" element={<BlogPost />} />
    {PrintCheckout && <Route path="/book/:id/order" element={protectedPage(PrintCheckout)} />}
    {MyOrders && <Route path="/orders" element={protectedPage(MyOrders)} />}
    {AdminPrintOrders && <Route path="/admin/print-orders" element={protectedPage(AdminPrintOrders)} />}
    {CheckoutHarness && <Route path="/__checkout-states" element={<CheckoutHarness />} />}
    {PrivacyGateHarness && <Route path="/__privacy-gate" element={<PrivacyGateHarness />} />}
    {UiGallery && <Route path="/__ui" element={<UiGallery />} />}
    <Route path="*" element={<NewNotFound />} />
  </Routes></PrivacyGate></Suspense>;
};

const AuthenticatedApp = () => {
  if (import.meta.env.VITE_NEW_SHELL === 'true' && isNewShell()) return <NewShellRoutes />;
  return <LegacyAuthenticatedApp />;
};

export const LegacyAuthenticatedApp = () => {
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
    LEGACY_HOME_PATHS.some((p) => location.pathname.toLowerCase() === p.toLowerCase()) ||
    location.pathname.startsWith('/blog') ||
    location.pathname.startsWith('/sign-in') ||
    location.pathname.startsWith('/sign-up') ||
    location.pathname === '/privacy' ||
    location.pathname === '/terms' ||
    location.pathname === '/welcome' ||
    location.pathname === '/contact' ||
    location.pathname === '/Contact' ||
    location.pathname === '/pricing' ||
    location.pathname === '/accessibility' ||
    (CheckoutHarness !== null && location.pathname === '/__checkout-states') ||
    (PrivacyGateHarness !== null && location.pathname === '/__privacy-gate');

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
        {/* Privacy gate: a signed-in parent who has not accepted the current policy version sees only the
            consent screen. Legal, marketing and sign-in pages stay open to everyone (see isGateExempt). */}
        <PrivacyGate enabled={!!user && !isGateExempt(location.pathname) && !(PrivacyGateHarness !== null && location.pathname === '/__privacy-gate')}>
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
          {/* Old home URL (/Dashboard) -> / , query string kept */}
          {LEGACY_HOME_PATHS.map((path) => (
            <Route key={path} path={path} element={<RedirectHome />} />
          ))}
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
          {PrintCheckout && (
            <Route path="/book/:id/order" element={<LayoutWrapper currentPageName="PrintCheckout"><PrintCheckout /></LayoutWrapper>} />
          )}
          {MyOrders && <Route path="/orders" element={<LayoutWrapper currentPageName="MyOrders"><MyOrders /></LayoutWrapper>} />}
          {AdminPrintOrders && (
            <Route path="/admin/print-orders" element={<LayoutWrapper currentPageName="AdminPrintOrders"><AdminPrintOrders /></LayoutWrapper>} />
          )}
          {CheckoutHarness && <Route path="/__checkout-states" element={<CheckoutHarness />} />}
          {PrivacyGateHarness && <Route path="/__privacy-gate" element={<PrivacyGateHarness />} />}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        </PrivacyGate>
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
