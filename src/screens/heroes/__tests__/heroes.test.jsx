import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Heroes from '../Heroes';
import HeroEditor from '../HeroEditor';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock('@/entities/Character', () => ({ Character: api }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'parent' } }) }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: (key, values) => values?.name ? `${key} ${values.name}` : key }), I18nProvider: ({children}) => children }));
const fixture = { id: 'h1', name: 'Noa', age: 7, personality: 'kind', appearance: 'curly hair', created_by: 'parent' };
const show = path => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/heroes" element={<Heroes/>}/><Route path="/heroes/new" element={<HeroEditor/>}/><Route path="/heroes/:id" element={<HeroEditor/>}/></Routes></MemoryRouter>);
beforeEach(() => { cleanup(); vi.resetAllMocks(); api.list.mockResolvedValue([fixture, { ...fixture, id: 'other', name:'Other', created_by:'another' }]); api.get.mockResolvedValue(fixture); });
describe('heroes', () => {
  it('lists only the current user’s heroes from the fixture', async () => { show('/heroes'); expect(await screen.findByText('Noa')).toBeInTheDocument(); expect(screen.queryByText('Other')).not.toBeInTheDocument(); expect(api.list).toHaveBeenCalledWith('-created_date'); });
  it('shows success only after the entity save resolves', async () => { let resolve; api.update.mockReturnValue(new Promise(r => { resolve = r; })); show('/heroes/h1'); fireEvent.change(await screen.findByLabelText('heroes.name'), { target: { value:'Noya' } }); fireEvent.click(screen.getByText('heroes.save')); expect(api.update).toHaveBeenCalledOnce(); expect(screen.queryByText('heroes.saved')).not.toBeInTheDocument(); resolve({ ...fixture, name:'Noya' }); expect(await screen.findByText('heroes.saved')).toBeInTheDocument(); });
  it('offers a retry after a failed save', async () => { api.update.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(fixture); show('/heroes/h1'); fireEvent.click(await screen.findByText('heroes.save')); expect(await screen.findByText('heroes.saveError')).toBeInTheDocument(); fireEvent.click(screen.getByText('heroes.save')); expect(await screen.findByText('heroes.saved')).toBeInTheDocument(); expect(api.update).toHaveBeenCalledTimes(2); });
  it('identifies required fields and marks the missing ones after save', () => {
    show('/heroes/new');
    const name = screen.getByLabelText('heroes.name');
    const personality = screen.getByLabelText('heroes.personality');
    const appearance = screen.getByLabelText('heroes.appearance');
    for (const field of [name, personality, appearance]) expect(field).toHaveAttribute('aria-required', 'true');
    fireEvent.click(screen.getByText('heroes.save'));
    for (const field of [name, personality, appearance]) expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('heroes.required');
    expect(api.create).not.toHaveBeenCalled();
  });
  it('creates a hero through the existing entity', async () => { api.create.mockResolvedValue(fixture); show('/heroes/new'); fireEvent.change(screen.getByLabelText('heroes.name'), { target:{ value:'Noa' } }); fireEvent.change(screen.getByLabelText('heroes.personality'), { target:{ value:'kind' } }); fireEvent.change(screen.getByLabelText('heroes.appearance'), { target:{ value:'curly hair' } }); fireEvent.click(screen.getByText('heroes.save')); await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({name:'Noa', personality:'kind', appearance:'curly hair'}))); });
  it('offers one action when the list is empty', async () => { api.list.mockResolvedValue([]); show('/heroes'); expect(await screen.findByText('heroes.empty')).toBeInTheDocument(); expect(screen.getAllByText('heroes.new')).toHaveLength(1); });
  it('shows an existing look without introducing a photo upload', async () => { api.get.mockResolvedValue({ ...fixture, primary_image_url:'https://example.invalid/hero.png' }); show('/heroes/h1'); expect(await screen.findByAltText('Noa')).toBeInTheDocument(); expect(document.querySelector('input[type=file]')).toBeNull(); });
  it('asks before leaving a changed form', async () => { const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); show('/heroes/h1'); fireEvent.change(await screen.findByLabelText('heroes.name'), { target:{ value:'Changed' } }); fireEvent.click(screen.getByText('heroes.back')); expect(confirm).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('heroes.name')).toHaveValue('Changed'); confirm.mockRestore(); });
  it('keeps edits visible offline and after reconnecting', async () => {
    show('/heroes/h1');
    const name = await screen.findByLabelText('heroes.name');
    fireEvent.change(name, {target:{value:'Changed'}});
    fireEvent(window, new Event('offline'));
    expect(screen.getByLabelText('heroes.name')).toHaveValue('Changed');
    expect(screen.getByText('heroes.offline')).toBeInTheDocument();
    expect(screen.getByText('heroes.save')).toBeDisabled();
    fireEvent(window, new Event('online'));
    expect(screen.getByLabelText('heroes.name')).toHaveValue('Changed');
    expect(screen.getByText('heroes.save')).toBeEnabled();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
  it('names the hero and preserves books in the delete dialog', async () => { show('/heroes/h1'); fireEvent.click(await screen.findByText('heroes.delete')); expect(screen.getByRole('alertdialog')).toHaveTextContent('Noa'); expect(screen.getByRole('alertdialog')).toHaveTextContent('heroes.deleteText'); expect(api.delete).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('heroes.cancel')); });
});

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: {id:'parent'}, isLoadingAuth: false, isLoadingPublicSettings: false }), AuthProvider: ({children}) => children, FallbackAuthProvider: ({children}) => children }));
vi.mock('@/components/privacy/PrivacyGate', () => ({ default: ({children}) => children }));
vi.mock('@/components/ClerkLocaleProvider', () => ({ default: ({children}) => children }));
vi.mock('@/lib/VisualEditAgent', () => ({ default: () => null }));
vi.mock('@/lib/NavigationTracker', () => ({ default: () => null }));
vi.mock('@/lib/errorTracking', () => ({ initErrorTracking: vi.fn(), captureError: vi.fn() }));
vi.mock('@/utils/storageCleanup', () => ({ cleanupStorage: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackPageView: vi.fn(), identifyUser: vi.fn() }));
vi.mock('@/lib/PageNotFound', () => ({ default: () => <div data-testid="legacy-page">NotFound</div> }));
vi.mock('@/pages.config', () => {
  const names = ['Home','LandingPage','Blog','BlogPost','PrivacyPolicy','TermsOfService','Accessibility','Characters'];
  return { pagesConfig: { Pages: Object.fromEntries(names.map(name => [name, () => <div data-testid="legacy-page">{name}</div>])), mainPage: 'Home', Layout: ({children}) => children } };
});
it('keeps legacy Characters and excludes new hero routes with the switch off', async () => {
  vi.stubEnv('VITE_NEW_SHELL', 'false');
  vi.stubEnv('DEV', false);
  try {
    const { default: App } = await import('../../../App.jsx?heroes-switch-off');
    for (const [path, expected] of [['/Characters','Characters'], ['/heroes','NotFound'], ['/heroes/new','NotFound'], ['/heroes/123','NotFound']]) {
      window.history.pushState({}, '', path);
      const view = render(<App />);
      expect(await screen.findByTestId('legacy-page')).toHaveTextContent(expected);
      expect(screen.queryByText('heroes.title')).not.toBeInTheDocument();
      expect(screen.queryByText('heroes.create')).not.toBeInTheDocument();
      view.unmount();
    }
  } finally { vi.unstubAllEnvs(); }
});
