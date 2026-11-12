import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import ReaderControls from '../ReaderControls';
import AdultExit from '../AdultExit';
import ReaderPage from '../ReaderPage';

const t = (key) => key;
describe('night reader', () => {
  it('bounds previous and next and marks the current dot', () => {
    const go = vi.fn(); render(<ReaderControls index={0} count={2} go={go} t={t} tts={{}} text="hello" />);
    expect(screen.getByRole('button', {name:'nightReader.previous'}).disabled).toBe(true);
    expect(screen.getByLabelText('nightReader.position 1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'nightReader.next'})); expect(go).toHaveBeenCalledWith(1);
  });
  it('plays and pauses through narration', () => {
    const speak = vi.fn(), pause = vi.fn(); const {rerender} = render(<ReaderControls index={0} count={1} go={() => {}} t={t} tts={{speak}} text="hello" />);
    fireEvent.click(screen.getByRole('button', {name:'nightReader.play'})); expect(speak).toHaveBeenCalledWith('hello');
    rerender(<ReaderControls index={0} count={1} go={() => {}} t={t} tts={{isSpeaking:true,pause}} text="hello" />);
    fireEvent.click(screen.getByRole('button', {name:'nightReader.pause'})); expect(pause).toHaveBeenCalled();
  });
  it('requires a two second adult hold', () => {
    vi.useFakeTimers(); const exit = vi.fn(); render(<AdultExit t={t} onExit={exit}/>); const button=screen.getByRole('button',{name:'nightReader.exit'});
    fireEvent.pointerDown(button); act(()=>vi.advanceTimersByTime(500)); fireEvent.pointerUp(button); expect(exit).not.toHaveBeenCalled();
    fireEvent.pointerDown(button); act(()=>vi.advanceTimersByTime(2000)); expect(exit).toHaveBeenCalledOnce(); vi.useRealTimers();
  });
  it('shows a calm fallback for missing art', () => { render(<ReaderPage page={{text_content:'hello'}} t={t}/>); expect(screen.getByText('nightReader.missingArt')).toBeTruthy(); });
});

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NightReader from '../NightReader';
import { useNightReader } from '../useNightReader';
vi.mock('../useNightReader', () => ({ useNightReader: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({t, language:'hebrew', isRTL:true}), I18nProvider: ({children}) => children }));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => ({speak:vi.fn(),stop:vi.fn(), currentWordIndex:-1}) }));
vi.mock('@/components/bookReader/TTSControls', () => ({ getStoredTTSEngine: () => 'browser' }));
const renderReader = (state, pages=[]) => {
  useNightReader.mockReturnValue({state, pages, index:0, setIndex:vi.fn(), book:{title:'Story'}});
  return render(<MemoryRouter initialEntries={['/book/1/read']}><Routes><Route path="/book/:id/read" element={<NightReader/>}/></Routes></MemoryRouter>);
};
describe('reader states', () => {
  it.each(['loading','building','paused','failed'])( 'shows %s state', (status) => {
    const internal = {loading:'loading', building:'starting', paused:'interrupted', failed:'failed'}[status];
    renderReader(internal); expect(screen.getByText(`nightReader.${status}`)).toBeTruthy();
  });
  it('keeps a ready page visible while more are building', () => {
    renderReader('building',[{text_content:'A ready page'}]);
    expect(screen.getByText('nightReader.building')).toBeTruthy(); expect(document.querySelector('.reader-text').textContent).toBe('A ready page');
  });
  it('disables next at the last page', () => {
    render(<ReaderControls index={1} count={2} go={vi.fn()} t={t} tts={{}} text="hello"/>);
    expect(screen.getByRole('button',{name:'nightReader.next'}).disabled).toBe(true);
  });
});

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({...auth, isLoadingAuth:false, isLoadingPublicSettings:false}), AuthProvider: ({children}) => children, FallbackAuthProvider: ({children}) => children }));
vi.mock('@/components/privacy/PrivacyGate', () => ({default: ({children}) => children}));
vi.mock('@/lib/PageNotFound', () => ({default: () => <div data-testid="route">NotFound</div>}));
vi.mock('@/lib/analytics', () => ({trackPageView: vi.fn(), identifyUser: vi.fn()}));
vi.mock('@/lib/NavigationTracker', () => ({default: () => null}));
vi.mock('@/lib/errorTracking', () => ({initErrorTracking: vi.fn(), captureError: vi.fn()}));
vi.mock('@/utils/storageCleanup', () => ({cleanupStorage: vi.fn()}));
vi.mock('@/components/ClerkLocaleProvider', () => ({default: ({children}) => children}));
vi.mock('@/pages/SignIn', () => ({default: () => <div data-testid="route">SignIn</div>}));
vi.mock('@/shell/AppShell', () => ({default: ({children}) => <div>{children}</div>}));
vi.mock('@/pages.config', () => {
  const names = ['Blog','BlogPost','BookCreation','PrivacyPolicy','TermsOfService','BookView','BookWizard','CharacterEditor','Characters','Community','CommunityPost','Feedback','Home','LandingPage','Leaderboard','Library','Profile','Settings','StoryIdeas','Contact','Pricing','Accessibility'];
  return {pagesConfig: {Pages: Object.fromEntries(names.map(name => [name, () => <div data-testid="route">{name}</div>])), mainPage:'Home', Layout: ({children}) => children}};
});

describe('App reader routing', () => {
  it('switch off keeps BookView and does not route the night reader', async () => {
    vi.stubEnv('VITE_NEW_SHELL', 'false'); vi.stubEnv('DEV', false); auth.user = {id:'fixture'};
    try {
      const {default: App} = await import('../../../App.jsx?reader-off');
      window.history.pushState({}, '', '/BookView?id=1');
      const view = render(<App />);
      expect(await screen.findByTestId('route')).toHaveTextContent('BookView');
      view.unmount(); window.history.pushState({}, '', '/book/1/read'); render(<App />);
      expect(await screen.findByTestId('route')).toHaveTextContent('NotFound');
      expect(screen.queryByRole('main', {name: /night reader/i})).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });
  it('redirects a signed-out night reader visit without rendering the reader', async () => {
    vi.stubEnv('VITE_NEW_SHELL', 'true'); auth.user = null;
    try {
      const {NewShellRoutes} = await import('../../../App.jsx?reader-on');
      render(<MemoryRouter initialEntries={['/book/1/read']}><NewShellRoutes /></MemoryRouter>);
      expect(await screen.findByTestId('route')).toHaveTextContent('SignIn');
      expect(screen.queryByText('Story')).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });
});

const entities = vi.hoisted(() => ({ privateBook: vi.fn(), privatePages: vi.fn(), publicBook: vi.fn(), publicPages: vi.fn() }));
vi.mock('@/entities/Book', () => ({Book: {get: entities.privateBook}}));
vi.mock('@/entities/Page', () => ({Page: {filter: entities.privatePages}}));
vi.mock('@/entities/PublicBook', () => ({PublicBook: {get: entities.publicBook}, PublicPage: {filter: entities.publicPages}}));
it('does not fall back to public entities when the private book fails', async () => {
  entities.privateBook.mockRejectedValue(new Error('not available'));
  entities.publicBook.mockResolvedValue({id:'1'});
  entities.publicPages.mockResolvedValue([]);
  const {useNightReader: realHook} = await vi.importActual('../useNightReader');
  const {result} = renderHook(() => realHook('1'));
  await waitFor(() => expect(result.current.state).toBe('failed'));
  expect(entities.publicBook).not.toHaveBeenCalled();
  expect(entities.publicPages).not.toHaveBeenCalled();
});
