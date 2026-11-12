import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: (k) => k, isRTL: true }) }));
const auth = { user: null, isLoadingAuth: false };
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => auth }));
const fetchSubscription = vi.fn();
const cancelMySubscription = vi.fn();
vi.mock('@/lib/ownerApi', () => ({ fetchSubscription: (...a) => fetchSubscription(...a), cancelMySubscription: (...a) => cancelMySubscription(...a) }));

import CancelSubscription from './CancelSubscription';

const show = () => render(<MemoryRouter><CancelSubscription /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); cleanup(); auth.user = null; auth.isLoadingAuth = false; });

describe('cancel subscription page', () => {
  it('signed out: explains the terms, offers sign-in, and always offers the email route with a prefilled subject', () => {
    show();
    expect(screen.getByText('cancelSubscription.what1')).toBeTruthy();
    expect(screen.getByText('cancelSubscription.what2')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'cancelSubscription.signIn' }).getAttribute('href')).toContain('/sign-in?redirect_url=');
    const mail = screen.getByRole('link', { name: /cancelSubscription.mailButton/ });
    expect(mail.getAttribute('href')).toMatch(/^mailto:support@sipurai\.ai\?subject=cancelSubscription\.mailSubject&body=/);
    expect(fetchSubscription).not.toHaveBeenCalled();
  });

  it('signed in with an active subscription: loading, then a button; confirm then cancel shows the done state', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValue({ active: true, plan: 'premium' });
    cancelMySubscription.mockResolvedValue({ ok: true });
    show();
    expect(screen.getByRole('status').textContent).toContain('cancelSubscription.loading');
    fireEvent.click(await screen.findByRole('button', { name: /cancelSubscription.button/ }));
    expect(cancelMySubscription).not.toHaveBeenCalled(); // needs the confirmation first
    fireEvent.click(screen.getByRole('button', { name: 'cancelSubscription.confirmYes' }));
    await waitFor(() => expect(cancelMySubscription).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByRole('status')).some((n) => n.textContent.includes('cancelSubscription.doneTitle'))).toBe(true);
  });

  it('cancel failure: error stays visible, nothing is shown as cancelled, the email route is still there', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValue({ active: true, plan: 'premium' });
    cancelMySubscription.mockRejectedValue(Object.assign(new Error('x'), { code: 'provider_failed' }));
    show();
    fireEvent.click(await screen.findByRole('button', { name: /cancelSubscription.button/ }));
    fireEvent.click(screen.getByRole('button', { name: 'cancelSubscription.confirmYes' }));
    expect((await screen.findByRole('alert')).textContent).toContain('cancelSubscription.errorGeneric');
    expect(screen.queryByText('cancelSubscription.doneTitle')).toBeNull();
    expect(screen.getByRole('link', { name: /cancelSubscription.mailButton/, hidden: true })).toBeTruthy(); // hidden only because the dialog is open
  });

  it('account whose token has no verified email: shows the email route prominently, no cancel button', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValue({ active: false, online: false });
    show();
    expect(await screen.findByText('cancelSubscription.emailOnlyTitle')).toBeTruthy();
    expect(screen.queryByText('cancelSubscription.noSub')).toBeNull(); // not "no subscription": we cannot tell
    expect(screen.queryByRole('button', { name: /cancelSubscription.button/ })).toBeNull();
    expect(screen.getByRole('link', { name: /cancelSubscription.mailButton/ })).toBeTruthy();
  });

  it('server says cannot_cancel_online at cancel time: dialog closes and the email route is shown', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValue({ active: true, plan: 'premium' });
    cancelMySubscription.mockRejectedValue(Object.assign(new Error('x'), { code: 'cannot_cancel_online' }));
    show();
    fireEvent.click(await screen.findByRole('button', { name: /cancelSubscription.button/ }));
    fireEvent.click(screen.getByRole('button', { name: 'cancelSubscription.confirmYes' }));
    expect(await screen.findByText('cancelSubscription.emailOnlyTitle')).toBeTruthy();
    expect(screen.queryByText('cancelSubscription.doneTitle')).toBeNull();
  });

  it('uncertain provider outcome says so (not "nothing was cancelled") and shows no success', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValue({ active: true, plan: 'premium' });
    cancelMySubscription.mockRejectedValue(Object.assign(new Error('x'), { code: 'provider_uncertain' }));
    show();
    fireEvent.click(await screen.findByRole('button', { name: /cancelSubscription.button/ }));
    fireEvent.click(screen.getByRole('button', { name: 'cancelSubscription.confirmYes' }));
    expect((await screen.findByRole('alert')).textContent).toContain('cancelSubscription.errorUncertain');
    expect(screen.queryByText('cancelSubscription.doneTitle')).toBeNull();
  });

  it('signed in without a subscription says so; a failed check offers retry', async () => {
    auth.user = { id: 'user_A' };
    fetchSubscription.mockResolvedValueOnce({ active: false });
    show();
    expect(await screen.findByText('cancelSubscription.noSub')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /cancelSubscription.button/ })).toBeNull();
    cleanup();
    fetchSubscription.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ active: true, plan: 'lite' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'cancelSubscription.retry' }));
    expect(await screen.findByRole('button', { name: /cancelSubscription.button/ })).toBeTruthy();
  });
});
