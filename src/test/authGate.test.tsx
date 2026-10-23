import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 auth: { getSession: mocks.getSession, onAuthStateChange: () => ({data:{subscription:{unsubscribe:vi.fn()}}}) },
 functions: { invoke: mocks.invoke },
} }));
import AuthGate from '@/components/AuthGate';
describe('temporary signed-in workspace testing', () => {
 afterEach(() => {cleanup();vi.useRealTimers();vi.clearAllMocks();});
 it('bounds stalled verification at eight seconds and ignores a late session', async () => {
  vi.useFakeTimers();
  let resolve: ((value: unknown) => void) | undefined;
  mocks.getSession.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  render(<MemoryRouter><AuthGate><div data-testid="workspace" /></AuthGate></MemoryRouter>);
  await act(()=>vi.advanceTimersByTimeAsync(8000));
  expect(screen.getByRole('button',{name:'Retry verification'})).toBeInTheDocument();
  await act(async()=>{resolve?.({data:{session:{user:{id:'late'}}}});});
  expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
  mocks.getSession.mockResolvedValueOnce({data:{session:{user:{id:'test-user'}}}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry verification'}));});
  expect(screen.getByTestId('workspace')).toBeInTheDocument();
 });
 it('does not launch overlapping checks while verification is pending', async () => {
  mocks.getSession.mockImplementationOnce(()=>new Promise(()=>{}));
  render(<MemoryRouter><AuthGate /></MemoryRouter>);
  fireEvent.focus(window);fireEvent.focus(window);
  expect(mocks.getSession).toHaveBeenCalledTimes(1);
 });
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