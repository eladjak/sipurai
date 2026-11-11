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
