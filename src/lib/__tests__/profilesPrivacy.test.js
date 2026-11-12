import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

import { resolveClerkIdByEmail, notifyMyFollowers } from '@/lib/profiles';

beforeEach(() => { rpc.mockReset(); from.mockReset(); });

describe('profiles privacy helpers', () => {
  it('resolveClerkIdByEmail uses the rpc and never reads the profiles table', async () => {
    rpc.mockResolvedValue({ data: 'user_abc', error: null });
    await expect(resolveClerkIdByEmail('a@b.co')).resolves.toBe('user_abc');
    expect(rpc).toHaveBeenCalledWith('resolve_clerk_id', { target_email: 'a@b.co' });
    expect(from).not.toHaveBeenCalled();
  });
  it('resolveClerkIdByEmail returns null on error or empty email', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(resolveClerkIdByEmail('a@b.co')).resolves.toBeNull();
    await expect(resolveClerkIdByEmail('')).resolves.toBeNull();
  });
  it('notifyMyFollowers calls the server-side fan-out rpc without any emails', async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    const n = await notifyMyFollowers({ type: 'new_book', title: 't', message: 'm', link: '/x' });
    expect(n).toBe(3);
    expect(rpc).toHaveBeenCalledWith('notify_my_followers', { p_type: 'new_book', p_title: 't', p_message: 'm', p_link: '/x' });
    expect(from).not.toHaveBeenCalled();
  });
  it('notifyMyFollowers throws on rpc error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(notifyMyFollowers({ type: 'new_book' })).rejects.toThrow('boom');
  });
});

describe('no browser code reads other users from profiles', () => {
  it.each(['src/hooks/useFollow.js', 'src/pages/BookWizard.jsx'])('%s has no .from(profiles)', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/from\(\s*['"]profiles['"]\s*\)/);
  });
  it('BookWizard announceNewBook uses notifyMyFollowers', () => {
    const src = readFileSync('src/pages/BookWizard.jsx', 'utf8');
    expect(src).toMatch(/notifyMyFollowers\(/);
  });
});
