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
  const client={auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},from:()=>query};
  const network=vi.fn();const handler=loadEdgeHandler('vv-news',network,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fixture'},()=>client);
  const r=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({country:'GB',page:2,publisher_only:true})}));
  expect(r.status).toBe(200);const data=await r.json();expect(data.publisher_news).toHaveLength(100);expect(data.has_more).toBe(true);expect(bounds).toEqual([[200,300]]);expect(network).not.toHaveBeenCalled();
 });
 it('does not return publisher records to an expired session',async()=>{
  const client={auth:{getUser:async()=>({data:{user:null},error:{message:'expired'}})},from:vi.fn()};
  const handler=loadEdgeHandler('vv-news',vi.fn(),{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fixture'},()=>client);
  const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({publisher_only:true})}));
  expect((await response.json()).publisher_status).toBe('sign_in_required');expect(client.from).not.toHaveBeenCalled();
 });
});
