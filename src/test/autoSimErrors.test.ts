import {vi,it,expect,beforeEach,afterEach} from 'vitest';
import {transferableAbortController} from 'node:util';
const mocks=vi.hoisted(()=>({getSession:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:mocks.getSession}}}));
import {callAutoSim} from '@/lib/autoSimApi';
beforeEach(()=>{mocks.getSession.mockReset();mocks.getSession.mockResolvedValue({data:{session:{access_token:'fixture'}}});vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);vi.stubEnv('VITE_SUPABASE_URL','https://fixture.supabase.co');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('does not consult Auth even when session acquisition would stall',async()=>{
 mocks.getSession.mockImplementationOnce(()=>new Promise(()=>{}));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true})));
 await expect(callAutoSim({action:'world_state'})).resolves.toEqual({ok:true});
 expect(mocks.getSession).not.toHaveBeenCalled();
});
it('includes stalled response consumption in the world-state deadline',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,text:()=>new Promise(()=>{})})));
 const checked=expect(callAutoSim({action:'world_state'})).rejects.toMatchObject({code:'timeout'});
 await vi.advanceTimersByTimeAsync(30000);await checked;
});
it.each([401,402,403,429,502,503])('preserves HTTP %i as an actionable API error',async status=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Membership or service unavailable'},{status})));
 await expect(callAutoSim({action:'run'})).rejects.toMatchObject({status});
 try{await callAutoSim({action:'run'});}catch(e){expect((e as {code:string}).code).not.toBe('invalid_response');}
});
