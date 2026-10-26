import {transferableAbortController} from 'node:util';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {loadEdgeHandler} from './helpers/edgeHarness';
beforeAll(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterAll(()=>vi.unstubAllGlobals());
describe('Public Intel research access',()=>{
 const values={GEMINI_API_KEY:'fixture-key'};
 const req=()=>new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({message:'Hypothetical Nasdaq rate hike?',history:[]})});
 it('answers without an auth session, anonymous sign-up, database or subscription quota',async()=>{
  const database=vi.fn(()=>{throw new Error('Identity database must not be required');});
  const fetcher=vi.fn().mockResolvedValue(Response.json({candidates:[{content:{parts:[{text:'A hypothetical risk, not a forecast.'}]}}]}));
  const response=await loadEdgeHandler('vv-chat',fetcher,values,database)(req());
  expect(response.status).toBe(200);expect((await response.json()).reply).toBe('A hypothetical risk, not a forecast.');
  expect(database).not.toHaveBeenCalled();
 });
 it('reports missing AI configuration rather than requesting sign-in',async()=>{
  const fetcher=vi.fn();const response=await loadEdgeHandler('vv-chat',fetcher,{},()=>({}))(req());
  expect(response.status).toBe(503);expect((await response.json()).error).toContain('not configured');expect(fetcher).not.toHaveBeenCalled();
 });
});
