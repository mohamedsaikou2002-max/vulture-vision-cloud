import {vi,it,expect,beforeEach,afterEach} from 'vitest';
import {transferableAbortController} from 'node:util';
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}}}));
import {callAutoSim} from '@/lib/autoSimApi';
beforeEach(()=>{vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);vi.stubEnv('VITE_SUPABASE_URL','https://fixture.supabase.co');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each([401,402,403,429,502,503])('preserves HTTP %i as an actionable API error',async status=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Membership or service unavailable'},{status})));
 await expect(callAutoSim({action:'run'})).rejects.toMatchObject({status});
 try{await callAutoSim({action:'run'});}catch(e){expect((e as {code:string}).code).not.toBe('invalid_response');}
});
