import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewStory from '../NewStory';
import StartStates from '../StartStates';
import translations from '@/components/i18n/locales/en/newStory';
import wizardCopy from '@/components/i18n/locales/en/spxWizard';
import { MemoryRouter } from 'react-router-dom';
const copy = { ...translations, spxWizard: {
  waiting: wizardCopy.spxWizard.waiting,
  writingCount: wizardCopy.spxWizard.writingCount,
  drawingCount: wizardCopy.spxWizard.drawingCount,
} };
const t = (key, params = {}) => (key.split('.').reduce((x, k) => x?.[k], copy) || key)
  .replace(/\{(\w+)\}/g, (_, name) => params[name]);
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t, language: 'english' }), I18nProvider: ({children}) => children }));
vi.mock('@/screens/heroes/useHeroes', () => ({ useHeroes: () => ({ heroes: [{id: '1', name: 'Maya'}], loading: false }) }));
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => vi.fn(), Link: ({children, to, ...props}) => <a href={to} {...props}>{children}</a> }));
vi.mock('@/lib/bookQuota', async () => ({ ...(await vi.importActual('@/lib/bookQuota')), newBookKey: () => 'key', reserveBookSlot: vi.fn(() => new Promise(() => {})), clearActiveBookKey: vi.fn() }));
vi.mock('@/lib/bookGeneration', () => ({ generateBookIncremental: vi.fn() }));
vi.mock('@/entities/Book', () => ({ Book: { generationStore: {}, get: vi.fn(async () => null), filter: vi.fn(async () => []) } }));
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn(async () => []) } }));
import { reserveBookSlot, QuotaError } from '@/lib/bookQuota';
import { generateBookIncremental } from '@/lib/bookGeneration';
beforeEach(() => { localStorage.clear(); });

describe('partial books', () => {
 it('routes a partial result to the family reader and repair action', () => {
   render(<StartStates state="partial" t={t} bookId="book/one" />);
   expect(screen.getByRole('status').textContent).toContain('spxWizard.partial');
   expect(screen.getByRole('link', {name:'spxWizard.repair'}).getAttribute('href')).toBe('/BookView?id=book%2Fone');
   expect(screen.queryByText('Your story is ready to read')).toBeNull();
 });
});
describe('new story', () => {
 it('keeps topic and selection when going back through three steps', () => { render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue')); fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'A moon journey'}}); fireEvent.click(screen.getByText('Continue')); fireEvent.click(screen.getByText('Back')); expect(screen.getByDisplayValue('A moon journey')).toBeTruthy(); });
 it('shows no invented quota and guards a double start', () => { render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue')); fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'Moon'}}); fireEvent.click(screen.getByText('Continue')); expect(screen.getByText('Your plan or gift allowance applies.')).toBeTruthy(); const button=screen.getByText('Start the story'); fireEvent.click(button); fireEvent.click(button); expect(reserveBookSlot).toHaveBeenCalledTimes(1); });
 it.each([['queued','Starting your story'],['slow','This is taking longer than usual'],['disconnected','Connection lost'],['failed','We could not finish the story'],['success','Your story is ready to read']])('shows the %s state', (state, title) => { render(<StartStates state={state} t={t} />); expect(screen.getByRole('status').textContent).toContain(title); });
 it('reserves only on creation and sends the saved book to durable resume after failure', async () => { vi.mocked(reserveBookSlot).mockReset().mockResolvedValue({ok:true}); vi.mocked(generateBookIncremental).mockReset().mockImplementationOnce(async ({onEvent}) => { onEvent({type:'book-created',bookId:'book-1'}); throw new Error('failed'); }).mockResolvedValueOnce({bookId:'book-1',status:'complete'}); render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue')); fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'Moon'}}); fireEvent.click(screen.getByText('Continue')); fireEvent.click(screen.getByText('Start the story')); await screen.findByText('We could not finish the story'); expect(screen.getByRole('status').textContent).not.toContain('not charged'); fireEvent.click(screen.getByText('Try again')); await screen.findByText('Writing has stopped'); expect(reserveBookSlot.mock.calls.map(call => call[0])).toEqual(['key']); expect(generateBookIncremental.mock.calls[0][0].newBookId).toBe('key'); expect(generateBookIncremental.mock.calls[1][0].bookId).toBe('book-1'); });
});

function beginStory() {
 render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue'));
 fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'Moon'}});
 fireEvent.click(screen.getByText('Continue')); fireEvent.click(screen.getByText('Start the story'));
}
describe('partial generation result', () => {
 it('shows partial and offers the family reader when generation settles partially', async () => {
  vi.mocked(reserveBookSlot).mockReset().mockResolvedValue({});
  vi.mocked(generateBookIncremental).mockReset().mockResolvedValue({bookId:'synthetic-book',status:'partial'});
  beginStory();
  const link = await screen.findByRole('link', {name:'spxWizard.repair'});
  expect(link.getAttribute('href')).toBe('/BookView?id=synthetic-book');
  expect(screen.queryByText('Your story is ready to read')).toBeNull();
 });
});
describe('reservation refusals', () => {
 it.each(['monthly_limit', 'daily_cap', 'another_refusal'])('shows server details for %s without claiming usage or starting generation', async code => {
  vi.mocked(generateBookIncremental).mockReset();
  vi.mocked(reserveBookSlot).mockReset().mockRejectedValue(new QuotaError({code, message_he:'Limit reached', resetsLabel:'Tomorrow', canUpgrade:true}));
  beginStory();
  expect(await screen.findByText('Limit reached')).toBeTruthy();
  expect(screen.getByText('Resets on')).toBeTruthy(); expect(screen.getByText('Tomorrow')).toBeTruthy();
  expect(screen.getByRole('link', {name:/view plans/i}).getAttribute('href')).toBe('/pricing');
  expect(screen.queryByText(/allowance may have been used/i)).toBeNull();
  expect(screen.queryByText('Try again')).toBeNull();
  expect(generateBookIncremental).not.toHaveBeenCalled();
 });
 it('does not invent a reset or upgrade for a refusal without them', async () => {
  vi.mocked(reserveBookSlot).mockReset().mockRejectedValue(new QuotaError({code:'daily_cap', message_he:'Daily limit'}));
  beginStory(); expect(await screen.findByText('Daily limit')).toBeTruthy();
  expect(screen.queryByRole('link', {name:/view plans/i})).toBeNull();
  expect(screen.getByRole('status').textContent).not.toContain('Tomorrow');
 });
 it('keeps genuine errors in the failed state', async () => {
  vi.mocked(reserveBookSlot).mockReset().mockRejectedValue(new Error('network error'));
  beginStory(); expect(await screen.findByText('We could not finish the story')).toBeTruthy();
 });
});

const routeAuth = vi.hoisted(() => ({ user: {id:'fixture'}, isLoadingAuth:false, isLoadingPublicSettings:false }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => routeAuth, AuthProvider: ({children}) => children, FallbackAuthProvider: ({children}) => children }));
vi.mock('@/components/ClerkLocaleProvider', () => ({default: ({children}) => children}));
vi.mock('@/components/privacy/PrivacyGate', () => ({default: ({children}) => children}));
vi.mock('@/lib/NavigationTracker', () => ({default: () => null}));
vi.mock('@/lib/errorTracking', () => ({initErrorTracking: vi.fn(), captureError: vi.fn()}));
vi.mock('@/utils/storageCleanup', () => ({cleanupStorage: vi.fn()}));
vi.mock('@/lib/analytics', () => ({trackPageView: vi.fn(), identifyUser: vi.fn()}));
vi.mock('@/shell/AppShell', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('@/lib/PageNotFound', () => ({default: () => <div>Legacy missing</div>}));
vi.mock('@/pages.config', () => {
  const Empty = () => null;
  const names = ['Blog', 'BlogPost', 'BookCreation', 'BookView', 'CharacterEditor', 'Community', 'CommunityPost',
    'Contact', 'Feedback', 'Leaderboard', 'Pricing', 'PrintEdition', 'PrivacyPolicy', 'Settings', 'TermsOfService', 'Accessibility'];
  return { pagesConfig: {
    Pages: { ...Object.fromEntries(names.map(name => [name, Empty])),
      Home: () => <div>Home</div>, LandingPage: () => <div>Landing</div>, BookWizard: () => <div>Old BookWizard</div> },
    mainPage: 'Home',
    Layout: ({ children }) => children,
  } };
});

describe('switch-off routing', () => {
 it('renders the old BookWizard and makes NewStory unreachable', async () => {
  vi.stubEnv('VITE_NEW_SHELL', 'false'); vi.stubEnv('DEV', false);
  try {
   const {default: App} = await import('@/App.jsx?new-story-switch-off');
   window.history.pushState({}, '', '/BookWizard');
   const view = render(<App />);
   expect(await screen.findByText('Old BookWizard')).toBeTruthy();
   expect(screen.queryByText('Who is the hero?')).toBeNull();
   view.unmount();
   window.history.pushState({}, '', '/new');
   render(<App />);
   expect(await screen.findByText('Legacy missing')).toBeTruthy();
   expect(screen.queryByText('Who is the hero?')).toBeNull();
  } finally { vi.unstubAllEnvs(); }
 });
});

it('shows real waiting stages, counts and slow guidance through the default /new route', async () => {
  vi.stubEnv('VITE_NEW_SHELL', 'true');
  let emit;
  let finish;
  vi.mocked(reserveBookSlot).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(generateBookIncremental).mockReset().mockImplementation(({ onEvent }) => {
    emit = onEvent;
    return new Promise(resolve => { finish = resolve; });
  });
  try {
    const { NewShellRoutes } = await import('@/App.jsx?new-story-waiting-route');
    render(<MemoryRouter initialEntries={['/new']}><NewShellRoutes /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Maya'));
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.change(screen.getByLabelText('What is the story about?'), { target: { value: 'Moon' } });
    fireEvent.click(screen.getByText('Continue'));

    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByText('Start the story')));
    expect(screen.getByRole('status')).toHaveTextContent('Starting your story');
    act(() => emit({ type: 'phase', phase: 'outline' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sketching the story');
    expect(screen.queryByText('Starting your story')).toBeNull();
    act(() => emit({ type: 'page-text', ready: 2, illustrated: 0, total: 2 }));
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 pages written');
    act(() => emit({ type: 'phase', phase: 'unknown' }));
    expect(screen.getByRole('status')).toHaveTextContent('The story is written');
    act(() => emit({ type: 'page-image', ready: 2, illustrated: 1, total: 2 }));
    expect(screen.getByRole('status')).toHaveTextContent('Drawing the story');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 illustrations drawn');
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole('status')).toHaveTextContent('This is taking longer than usual');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 illustrations drawn');
    expect(screen.getByRole('link', { name: 'Go to my shelf' })).toHaveAttribute('href', '/shelf');
    expect(screen.getByRole('heading', { name: 'Your story as it is written' })).toBeTruthy();
    await act(async () => finish({ bookId: 'book-for-fixture', status: 'partial' }));
    expect(screen.getByRole('link', { name: 'spxWizard.repair' })).toBeTruthy();
  } finally {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  }
});
