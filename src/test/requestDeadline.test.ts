import { afterEach, expect, it, vi } from 'vitest';
import { withRequestDeadline } from '@/lib/requestDeadline';
afterEach(()=>vi.useRealTimers());
it('bounds work even when the operation ignores abort',async()=>{
 vi.useFakeTimers();
 const result=withRequestDeadline(()=>new Promise(()=>{}),8000);
 const checked=expect(result).rejects.toMatchObject({name:'TimeoutError'});
 await vi.advanceTimersByTimeAsync(8000);await checked;
});
it('passes cancellation to network work and clears completed timers',async()=>{
 vi.useFakeTimers();const parent=new AbortController();let signal:AbortSignal|undefined;
 const result=withRequestDeadline(s=>{signal=s;return new Promise(()=>{});},30000,parent.signal);
 const checked=expect(result).rejects.toMatchObject({name:'AbortError'});
 parent.abort();await checked;expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('returns successful work without leaving a deadline timer',async()=>{
 vi.useFakeTimers();expect(await withRequestDeadline(async()=>42,8000)).toBe(42);
 expect(vi.getTimerCount()).toBe(0);
});