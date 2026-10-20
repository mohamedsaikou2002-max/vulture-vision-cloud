import {transferableAbortController} from 'node:util';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {loadEdgeHandler} from './helpers/edgeHarness';
beforeAll(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterAll(()=>vi.unstubAllGlobals());
describe('Member Intel research access',()=>{
 const values={SUPABASE_URL:'https://fixture.example',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',GEMINI_API_KEY:'fixture-key'};
 const req=()=>new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture-session'},body:JSON.stringify({message:'Hypothetical Nasdaq rate hike?',history:[]})});
 it('allows a signed-in nonoperator with reserved research quota',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:true,error:null});
  const client={auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},rpc};
  const fetcher=vi.fn().mockResolvedValue(Response.json({candidates:[{content:{parts:[{text:'A hypothetical risk, not a forecast.'}]}}]}));
  const response=await loadEdgeHandler('vv-chat',fetcher,values,()=>client)(req());
  expect(response.status).toBe(200);expect((await response.json()).reply).toBe('A hypothetical risk, not a forecast.');
  expect(rpc).toHaveBeenCalledWith('claim_scenario_synthesis',{p_user_id:'member'});
 });
 it('rejects an exhausted shared quota before Gemini',async()=>{
  const fetcher=vi.fn();const client={auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},rpc:async(name:string)=>({data:name==='vv_workspace_access',error:null})};
  expect((await loadEdgeHandler('vv-chat',fetcher,values,()=>client)(req())).status).toBe(429);expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects an expired user session before Gemini',async()=>{
  const fetcher=vi.fn();const client={auth:{getUser:async()=>({data:{user:null},error:{message:'expired'}})}};
  expect((await loadEdgeHandler('vv-chat',fetcher,values,()=>client)(req())).status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
 });
});