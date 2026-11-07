import { transferableAbortController } from 'node:util';
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { loadEdgeHandler } from './helpers/edgeHarness';
beforeAll(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterAll(()=>vi.unstubAllGlobals());
describe('Publisher archive paging',()=>{
 it('reads the next indexed page without fetching external feeds and signals more results',async()=>{
  const bounds:number[][]=[];
  const rows=Array.from({length:101},(_,i)=>({id:String(i),title:'Reported event',source:'Publisher',canonical_url:'https://example.com/'+i,published_at:new Date().toISOString(),source_country:'GB'}));
  const query={select:()=>query,gte:()=>query,or:()=>query,order:()=>query,abortSignal:()=>query,eq:()=>query,range:(a:number,b:number)=>{bounds.push([a,b]);return query;},then:(done:(r:unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(done)};
  const getUser=vi.fn(()=>{throw new Error('Paid member fixture intercepts identity lookup');});
  const client={auth:{getUser},from:()=>query,rpc:async()=>({data:true,error:null})};
  const network=vi.fn();const handler=loadEdgeHandler('vv-news',network,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',__TEST_MEMBER_ID:'fixture-member'},()=>client);
  const r=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture-member'},body:JSON.stringify({country:'GB',page:2,publisher_only:true})}));
  expect(r.status).toBe(200);const data=await r.json();expect(data.publisher_news).toHaveLength(100);expect(data.has_more).toBe(true);expect(bounds).toEqual([[200,300]]);expect(network).not.toHaveBeenCalled();expect(getUser).not.toHaveBeenCalled();
 });
 it('denies news requests when an expired session has no verified identity',async()=>{
  const getUser=vi.fn(async()=>({data:{user:null},error:{message:'Invalid token'}}));
  const query={select:()=>query,gte:()=>query,or:()=>query,order:()=>query,range:()=>query,abortSignal:()=>query,then:(done:(r:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(done)};
  const handler=loadEdgeHandler('vv-news',vi.fn(),{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',SUPABASE_ANON_KEY:'public'},()=>({auth:{getUser},from:()=>query}));
  const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer expired-fixture'},body:JSON.stringify({publisher_only:true})}));
  expect(response.status).toBe(401);expect(getUser).toHaveBeenCalled();
 });
});
