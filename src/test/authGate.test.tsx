import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 auth: { getSession: mocks.getSession, onAuthStateChange: () => ({data:{subscription:{unsubscribe:vi.fn()}}}) },
 functions: { invoke: mocks.invoke },
} }));
import AuthGate from '@/components/AuthGate';
describe('temporary signed-in workspace testing', () => {
 afterEach(() => {cleanup();vi.clearAllMocks();});
 it('allows signed-in entry without billing verification', async () => {
  mocks.getSession.mockResolvedValue({data:{session:{user:{id:'test-user'}}}});
  render(<MemoryRouter><AuthGate><div data-testid="workspace" /></AuthGate></MemoryRouter>);
  expect(await screen.findByTestId('workspace')).toBeInTheDocument();
  expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('denies workspace entry without a session', async () => {
  mocks.getSession.mockResolvedValue({data:{session:null}});
  render(<MemoryRouter><AuthGate><div data-testid="workspace" /></AuthGate></MemoryRouter>);
  await screen.findByRole('link',{name:'Sign in'});
  expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
 });
});