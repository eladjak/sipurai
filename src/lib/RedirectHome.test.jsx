import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import RedirectHome, { LEGACY_HOME_PATHS } from "./RedirectHome";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="where">{pathname + search + hash}</div>;
}

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Where />} />
        {LEGACY_HOME_PATHS.map((p) => (
          <Route key={p} path={p} element={<RedirectHome />} />
        ))}
        <Route path="*" element={<div data-testid="not-found" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("legacy /Dashboard redirect", () => {
  it.each(["/Dashboard", "/dashboard", "/DASHBOARD"])("%s lands on /", (url) => {
    renderAt(url);
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.queryByTestId("not-found")).toBeNull();
  });

  it("keeps the query string and hash", () => {
    renderAt("/Dashboard?plan=lite&checkout=ok#top");
    expect(screen.getByTestId("where").textContent).toBe("/?plan=lite&checkout=ok#top");
  });

  it("does not swallow other unknown paths", () => {
    renderAt("/Dashboards");
    expect(screen.getByTestId("not-found")).toBeInTheDocument();
  });
});

vi.hoisted(() => { vi.stubEnv('VITE_NEW_SHELL', 'true'); });
const legacyAuth = vi.hoisted(() => ({ user: null, navigateToLogin: vi.fn() }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ ...legacyAuth, isLoadingAuth: false, isLoadingPublicSettings: false }), AuthProvider: ({children}) => children, FallbackAuthProvider: ({children}) => children }));
vi.mock('@/components/privacy/PrivacyGate', () => ({ default: ({children}) => children }));
vi.mock('@/lib/PageNotFound', () => ({ default: () => <div data-testid="page">NotFound</div> }));
vi.mock('@/lib/analytics', () => ({ trackPageView: vi.fn(), identifyUser: vi.fn() }));
vi.mock('../pages.config', () => {
  const names = ['Blog','BlogPost','BookCreation','PrivacyPolicy','TermsOfService','BookView','BookWizard','CharacterEditor','Characters','Community','CommunityPost','Feedback','Home','LandingPage','Leaderboard','Library','Profile','Settings','StoryIdeas','Contact','Pricing','Accessibility'];
  const Pages = Object.fromEntries(names.map(name => [name, () => <div data-testid="page">{name}</div>]));
  return { pagesConfig: { Pages, mainPage: 'Home', Layout: ({children}) => <div data-testid="layout">{children}</div> } };
});
import { LegacyAuthenticatedApp } from '../App';

const registryFixture = {
  Blog: true, BlogPost: true, BookCreation: false, PrivacyPolicy: true,
  TermsOfService: true, BookView: true, BookWizard: false, CharacterEditor: false,
  Characters: false, Community: false, CommunityPost: false, Feedback: false,
  Home: false, LandingPage: true, Leaderboard: false, Library: false,
  Profile: false, Settings: false, StoryIdeas: false, Contact: true, Pricing: true,
  Accessibility: true,
};

describe('legacy route equivalence fixture from main', () => {
  it.each(Object.entries(registryFixture))('signed-in /%s keeps its page and layout', (name, publicPage) => {
    legacyAuth.user = { id: 'fixture' }; legacyAuth.navigateToLogin.mockClear();
    render(<MemoryRouter initialEntries={[`/${name}`]}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent(name);
    expect(Boolean(screen.queryByTestId('layout'))).toBe(!publicPage);
  });
  it.each(Object.entries(registryFixture))('guest /%s keeps its page or login guard', (name, publicPage) => {
    legacyAuth.user = null; legacyAuth.navigateToLogin.mockClear();
    render(<MemoryRouter initialEntries={[`/${name}`]}><LegacyAuthenticatedApp /></MemoryRouter>);
    if (publicPage) expect(screen.getByTestId('page')).toHaveTextContent(name);
    else expect(legacyAuth.navigateToLogin).toHaveBeenCalled();
  });
  it('keeps the unknown guest on the legacy login path', () => {
    legacyAuth.user = null; legacyAuth.navigateToLogin.mockClear();
    render(<MemoryRouter initialEntries={['/not-a-route']}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(legacyAuth.navigateToLogin).toHaveBeenCalled();
  });
});

describe('legacy explicit route fixture', () => {
  it.each([['/welcome','LandingPage'], ['/blog','Blog'], ['/blog/story','BlogPost'], ['/privacy','PrivacyPolicy'], ['/terms','TermsOfService'], ['/pricing','Pricing'], ['/accessibility','Accessibility']])('guest %s renders %s without layout', (path, page) => {
    legacyAuth.user = null; legacyAuth.navigateToLogin.mockClear();
    render(<MemoryRouter initialEntries={[path]}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent(page);
    expect(screen.queryByTestId('layout')).toBeNull();
  });
  it.each([[null, 'LandingPage', false], [{id:'fixture'}, 'Home', true]])('root chooses the correct home', (user, page, layout) => {
    legacyAuth.user = user;
    render(<MemoryRouter initialEntries={['/']}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent(page);
    expect(Boolean(screen.queryByTestId('layout'))).toBe(layout);
  });
  it('redirects a guest from Dashboard to the landing page', () => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={['/Dashboard']}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent('LandingPage');
  });
  it('renders legacy not found inside the gate for signed-in users', () => {
    legacyAuth.user = { id: 'fixture' };
    render(<MemoryRouter initialEntries={['/not-a-route']}><LegacyAuthenticatedApp /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent('NotFound');
  });
});

vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }), I18nProvider: ({children}) => children }));
vi.mock('@/pages/SignIn', () => ({ default: () => <Where /> }));
vi.mock('@/pages/SignUp', () => ({ default: () => <div data-testid="page">SignUp</div> }));
vi.mock('@/screens/tonight/Tonight', () => ({ default: () => <div data-testid="page">Tonight</div> }));
vi.mock('@/shell/AppShell', () => ({ default: ({children}) => <div data-testid="shell">{children}</div> }));
vi.mock('@/screens/notfound/NotFound', () => ({ default: () => <div data-testid="page">NotFound</div> }));
vi.mock('@/pages/UiGallery', () => ({ default: () => <div data-testid="page">Gallery</div> }));
import { NewShellRoutes } from '../App';

describe('new shell routing behavior', () => {
  const publicAddresses = [
    ['/', 'LandingPage'], ['/welcome','LandingPage'], ['/LandingPage','LandingPage'],
    ['/blog','Blog'], ['/blog/story','BlogPost'], ['/Blog','Blog'], ['/BlogPost','BlogPost'],
    ['/privacy','PrivacyPolicy'], ['/PrivacyPolicy','PrivacyPolicy'], ['/terms','TermsOfService'],
    ['/TermsOfService','TermsOfService'], ['/pricing','Pricing'], ['/Pricing','Pricing'],
    ['/contact','Contact'], ['/Contact','Contact'], ['/accessibility','Accessibility'],
    ['/Accessibility','Accessibility'], ['/BookView?id=1','BookView'], ['/Home','LandingPage'], ['/Dashboard','LandingPage'],
  ];
  it.each(publicAddresses)('guest can open %s', async (path, page) => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={[path]}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('page')).toHaveTextContent(page);
  });
  it.each(publicAddresses)('signed-in reader can open public address %s', async (path, page) => {
    legacyAuth.user = {id:'fixture'};
    render(<MemoryRouter initialEntries={[path]}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('page')).toHaveTextContent(path === '/Home' || path === '/Dashboard' || path === '/LandingPage' || path === '/' ? 'Tonight' : page);
  });
  it.each([['/sign-in','where'], ['/sign-up','page']])('guest can open %s', async (path, marker) => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={[path]}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId(marker)).toBeInTheDocument();
  });
  it.each(['/shelf','/heroes','/parents','/new','/help','/CharacterEditor','/CommunityPost','/BookCreation','/Feedback','/Leaderboard','/Community'])('guest request %s receives no protected page data', async path => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={[path]}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('where')).toHaveTextContent(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
    expect(screen.queryByTestId('page')).toBeNull();
  });
  it.each([['/BookWizard','/new'], ['/Library?tab=drafts#x','/shelf?tab=drafts#x']])('redirects %s through the router', async (path, target) => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={[path]}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('where')).toHaveTextContent(`/sign-in?redirect_url=${encodeURIComponent(target)}`);
  });
  it('shows the guest 404', async () => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={['/missing']}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('page')).toHaveTextContent('NotFound');
  });
  it('shows the gallery when enabled in development', async () => {
    legacyAuth.user = null;
    render(<MemoryRouter initialEntries={['/__ui']}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('page')).toHaveTextContent('Gallery');
  });
  it('hides the gallery in a production build without its flag', async () => {
    legacyAuth.user = null;
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_UI_GALLERY', '0');
    try {
      const { NewShellRoutes: ProductionRoutes } = await import('../App.jsx?production-gallery-test');
      render(<MemoryRouter initialEntries={['/__ui']}><ProductionRoutes /></MemoryRouter>);
      expect(await screen.findByTestId('page')).toHaveTextContent('NotFound');
    } finally {
      vi.stubEnv('DEV', true);
    }
  });
  it('wraps the shared book for a signed-in reader', async () => {
    legacyAuth.user = {id:'fixture'};
    render(<MemoryRouter initialEntries={['/BookView?id=1']}><NewShellRoutes /></MemoryRouter>);
    expect(await screen.findByTestId('shell')).toHaveTextContent('BookView');
  });
});

vi.mock('@/components/ClerkLocaleProvider', () => ({ default: ({children}) => children }));
vi.mock('@/lib/NavigationTracker', () => ({ default: () => null }));
vi.mock('@/lib/errorTracking', () => ({ initErrorTracking: vi.fn() }));
vi.mock('@/utils/storageCleanup', () => ({ cleanupStorage: vi.fn() }));

describe('switch-off App integration', () => {
  it.each([null, {id:'fixture'}])('keeps public pages and auth routes open for %s', async user => {
    legacyAuth.user = user;
    vi.stubEnv('VITE_NEW_SHELL', 'false');
    try {
      const { default: App } = await import('../App.jsx?legacy-app-test');
      for (const [path, page, marker] of [
        ['/welcome','LandingPage','page'], ['/blog','Blog','page'], ['/blog/story','BlogPost','page'],
        ['/privacy','PrivacyPolicy','page'], ['/terms','TermsOfService','page'], ['/pricing','Pricing','page'],
        ['/contact','Contact','page'], ['/accessibility','Accessibility','page'], ['/BookView?id=1','BookView','page'],
        ['/sign-in','/sign-in','where'], ['/sign-up','SignUp','page'],
      ]) {
        window.history.pushState({}, '', path);
        const view = render(<App />);
        expect(await screen.findByTestId(marker)).toHaveTextContent(page);
        view.unmount();
      }
    } finally {
      vi.stubEnv('VITE_NEW_SHELL', 'true');
    }
  });
});
