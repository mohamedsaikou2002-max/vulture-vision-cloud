import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { workspaceSession } from '@/lib/workspaceSession';
afterEach(() => vi.useRealTimers());
const client = (getSession: ReturnType<typeof vi.fn>, signInAnonymously = vi.fn()) => ({ auth: { getSession, signInAnonymously } }) as unknown as SupabaseClient;
describe('free private workspace identity', () => {
  it('reuses an existing identity without guest creation or billing', async () => {
    const session = { access_token: 'existing' }, create = vi.fn();
    expect(await workspaceSession(client(vi.fn().mockResolvedValue({ data: { session } }), create))).toBe(session);
    expect(create).not.toHaveBeenCalled();
  });
  it('creates one guest identity for concurrent requests', async () => {
    const session = { access_token: 'guest' };
    const create = vi.fn().mockResolvedValue({ data: { session } });
    const api = client(vi.fn().mockResolvedValue({ data: { session: null } }), create);
    expect(await Promise.all([workspaceSession(api), workspaceSession(api)])).toEqual([session, session]);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('reports disabled anonymous auth without presenting checkout', async () => {
    const api = client(vi.fn().mockResolvedValue({ data: { session: null } }), vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'disabled' } }));
    await expect(workspaceSession(api)).rejects.toThrow('Enable anonymous sign-ins');
  });
  it('bounds stalled session refresh instead of blocking indefinitely', async () => {
    vi.useFakeTimers();
    const api = client(vi.fn().mockReturnValue(new Promise(() => {})));
    const check = expect(workspaceSession(api)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await check;
  });
});
