import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AuthFeedback } from './AuthFeedback';
const state = vi.hoisted(() => ({ status: 'loading' }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('@clerk/clerk-react', () => ({
  ClerkLoading: ({ children }) => state.status === 'loading' ? children : null,
  ClerkFailed: ({ children }) => state.status === 'error' ? children : null,
  ClerkLoaded: ({ children }) => state.status === 'ready' ? children : null,
}));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('authentication feedback', () => {
  it('shows a polite loading message and offers retry after a long wait', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test'); vi.useFakeTimers(); state.status = 'loading';
    render(<AuthFeedback><p>form</p></AuthFeedback>);
    expect(screen.getByRole('status')).toHaveTextContent('auth.loadingMessage');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('status')).toHaveTextContent('auth.slowMessage');
    expect(screen.getByRole('button', { name: 'auth.retry' })).toBeInTheDocument();
  });
  it('announces provider failure and offers a retry', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test'); state.status = 'error';
    render(<AuthFeedback><p>form</p></AuthFeedback>);
    expect(screen.getByRole('alert')).toHaveTextContent('auth.failedMessage');
    expect(screen.getByRole('button', { name: 'auth.retry' })).toBeInTheDocument();
  });
  it('renders the form once ready', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'test'); state.status = 'ready';
    render(<AuthFeedback><p>form</p></AuthFeedback>);
    expect(screen.getByText('form')).toBeInTheDocument();
  });
  it('handles missing local configuration without invoking Clerk controls', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', ''); state.status = 'ready';
    render(<AuthFeedback><p>form</p></AuthFeedback>);
    expect(screen.getByRole('alert')).toHaveTextContent('auth.unavailableMessage');
    expect(screen.queryByText('form')).not.toBeInTheDocument();
  });
});
