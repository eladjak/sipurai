import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const logout = vi.fn();
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user_A' }, logout }) }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ language: 'hebrew', isRTL: true }) }));
const fetchConsentStatus = vi.fn();
const acceptConsent = vi.fn();
vi.mock('@/lib/privacyConsent', async () => {
  const actual = await vi.importActual('@/lib/privacyConsent');
  return { ...actual, fetchConsentStatus: (...a) => fetchConsentStatus(...a), acceptConsent: (...a) => acceptConsent(...a) };
});

import PrivacyGate from './PrivacyGate';
import { gateCopy } from '@/data/privacyPolicyContent';

const he = gateCopy.he;
const tickAll = () => {
  for (const id of ['gate-guardian', 'gate-privacy', 'gate-terms']) fireEvent.click(document.getElementById(id));
};

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};
const App = () => <div>THE-APP</div>;

beforeEach(() => {
  logout.mockReset();
  fetchConsentStatus.mockReset();
  acceptConsent.mockReset();
});

describe('PrivacyGate', () => {
  it('shows the consent screen and NOT the app when the parent has not accepted', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    expect(await screen.findByRole('heading', { level: 1, name: /ההחלטה בידיים שלכם/ })).toBeTruthy();
    expect(screen.queryByText('THE-APP')).toBeNull();
  });

  it('lets the app through when the current policy was accepted', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: true });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    expect(await screen.findByText('THE-APP')).toBeTruthy();
  });

  it('fails CLOSED: if the server cannot say, the app stays shut and a retry is offered', async () => {
    fetchConsentStatus.mockRejectedValue(new Error('boom'));
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    // the gate retries once (about a second) before giving up
    expect(await screen.findByText(/לא הצלחנו לבדוק את אישור הפרטיות/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('THE-APP')).toBeNull();
    expect(screen.getByRole('button', { name: 'נסו שוב' })).toBeTruthy();
  });

  it('does nothing on pages that are open to everyone (enabled=false)', () => {
    wrap(<PrivacyGate enabled={false}><App /></PrivacyGate>);
    expect(screen.getByText('THE-APP')).toBeTruthy();
    expect(fetchConsentStatus).not.toHaveBeenCalled();
  });

  it('refuses to submit until BOTH boxes are ticked, and says so', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    const accept = await screen.findByRole('button', { name: 'אישור והמשך' });
    fireEvent.click(accept);
    expect(await screen.findByText(he.missing)).toBeTruthy();
    expect(acceptConsent).not.toHaveBeenCalled();
    fireEvent.click(document.getElementById('gate-guardian'));
    fireEvent.click(accept);
    expect(acceptConsent).not.toHaveBeenCalled(); // one box is not enough
    fireEvent.click(document.getElementById('gate-privacy'));
    fireEvent.click(accept);
    expect(acceptConsent).not.toHaveBeenCalled(); // two boxes are not enough
  });

  it('shows three labelled boxes in order, and focuses the first missing one', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    const accept = await screen.findByRole('button', { name: 'אישור והמשך' });
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: he.guardian })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: he.privacyItem })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: he.termsItem })).toBeTruthy();
    fireEvent.click(document.getElementById('gate-guardian'));
    fireEvent.click(accept);
    await waitFor(() => expect(document.activeElement?.id).toBe('gate-privacy'));
  });

  it('a returning parent sees the "updated" title, lead and the what-changed list; a new parent does not', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false, returning: true });
    const first = wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    expect(await screen.findByRole('heading', { level: 1, name: he.updatedTitle })).toBeTruthy();
    expect(screen.getByText(he.updatedLead)).toBeTruthy();
    const list = screen.getByTestId('what-changed');
    expect(list.querySelectorAll('li')).toHaveLength(he.whatChanged.length);
    first.unmount();

    fetchConsentStatus.mockResolvedValue({ hasConsent: false, returning: false });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    expect(await screen.findByRole('heading', { level: 1, name: he.title })).toBeTruthy();
    expect(screen.queryByTestId('what-changed')).toBeNull();
  });

  it('saves the acceptance with both boxes ticked, then opens the app', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    acceptConsent.mockResolvedValue({ ok: true });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    await screen.findByRole('button', { name: 'אישור והמשך' });
    tickAll();
    fireEvent.click(screen.getByRole('button', { name: 'אישור והמשך' }));
    await waitFor(() => expect(acceptConsent).toHaveBeenCalledTimes(1));
    expect(acceptConsent.mock.calls[0][0]).toEqual({ locale: 'he' });
    expect(await screen.findByText('THE-APP', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('shows an error and offers retry when saving fails; the app stays shut', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    acceptConsent.mockRejectedValue(Object.assign(new Error('network'), { code: 'network' }));
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    await screen.findByRole('button', { name: 'אישור והמשך' });
    tickAll();
    fireEvent.click(screen.getByRole('button', { name: 'אישור והמשך' }));
    expect(await screen.findByText(/לא הצלחנו לשמור את האישור/)).toBeTruthy();
    expect(screen.queryByText('THE-APP')).toBeNull();
  });

  it('"not now" signs the parent out', async () => {
    fetchConsentStatus.mockResolvedValue({ hasConsent: false });
    wrap(<PrivacyGate enabled><App /></PrivacyGate>);
    fireEvent.click(await screen.findByRole('button', { name: 'לא עכשיו' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
