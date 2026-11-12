// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ParentsHub from '../ParentsHub';
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { hasConsent: true } }) }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: k => k, language: 'english', isRTL: false, changeLanguage: vi.fn(), languages: { english: {}, hebrew: {} } }) }));
vi.mock('@/hooks/useSubscription', () => ({ default: () => ({ plan: 'free', isLoading: false }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { dark_mode: false } }) }));
vi.mock('@/components/settings/AccountDataControls', () => ({ default: p => <div data-testid="account">{p.language}/{String(p.isRTL)}/{typeof p.onDeleted}</div> }));
vi.mock('@/lib/privacyConsent', () => ({ fetchConsentStatus: vi.fn().mockResolvedValue({ hasConsent: true }), CURRENT_POLICY_VERSION: '1' }));
vi.mock('@/entities/User', () => ({ User: { updateMyUserData: vi.fn() } }));
function show(printEnabled) { return render(<MemoryRouter><ParentsHub printEnabled={printEnabled}/></MemoryRouter>); }
describe('parent hub', () => {
 it('shows plan, look, privacy and help and passes the original account props', () => { show(false); for (const k of ['parents.plan','parents.look','parents.privacy','parents.help']) expect(screen.getByText(k)).toBeTruthy(); expect(screen.getByTestId('account').textContent).toBe('english/false/function'); cleanup(); });
 it('shows orders only when printing is enabled', () => { show(false); expect(screen.queryByText('parents.orders')).toBeNull(); cleanup(); show(true); expect(screen.getByText('parents.orders').closest('a').getAttribute('href')).toBe('/orders'); cleanup(); });
});
