import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/privacyConsent', () => ({ deleteMyAccount: vi.fn() }));

import AccountDataControls from './AccountDataControls';

describe('AccountDataControls (delete-account button flag)', () => {
  it('OFF by default: no delete button, a clear email way out instead', () => {
    render(<AccountDataControls enabled={false} language="hebrew" isRTL />);
    expect(screen.queryByRole('button', { name: /מחיקת החשבון והנתונים/ })).toBeNull();
    expect(screen.getByTestId('delete-by-email').textContent).toContain('support@sipurai.ai');
  });
  it('the flag value used by the app is false unless VITE_ACCOUNT_DELETE_ENABLED=true', async () => {
    const mod = await import('@/data/privacyPolicyContent');
    expect(mod.ACCOUNT_DELETE_UI).toBe(false);
  });
  it('ON: the delete button is shown', () => {
    render(<AccountDataControls enabled language="hebrew" isRTL />);
    expect(screen.getByRole('button', { name: /מחיקת החשבון והנתונים/ })).toBeTruthy();
  });
});
