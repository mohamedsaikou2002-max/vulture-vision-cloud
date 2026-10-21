import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {transferableAbortController} from 'node:util';
import {loadEdgeHandler} from './helpers/edgeHarness';
beforeAll(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterAll(()=>vi.unstubAllGlobals());
const client=()=>({auth:{getUser:async()=>({data:{user:{id:'fixture-member'}},error:null})},rpc:async()=>({data:true,error:null})});
const base={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'};
const panel={answer:'Conditional research answer',specialists:[{role:'bull',position:'Test the recovery thesis',reasoning:'Verify funding evidence'}],disagreements:[],missing_evidence:['Live evidence'],experiments:[],evidence_ids:[]};
const request=(name:string)=>new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture-session'},body:JSON.stringify(name==='vv-chat'?{message:'Explain conditional Nasdaq funding risks',history:[]}:{question:'Explain conditional Nasdaq funding risks',scenario:'A hypothetical funding shock',mode:'bull',history:[],contextSummary:'No live evidence supplied',asOf:new Date().toISOString(),news:[],report:'',runStatus:'not_started',round:0})});
for(const name of ['vv-chat','vv-simulation-chat'])describe(name+' real AI route',()=>{
 it('falls back only after a native model 404 and returns the provider answer',async()=>{
  const text=name==='vv-chat'?panel.answer:JSON.stringify(panel);
  const fetcher=vi.fn().mockImplementationOnce(async()=>new Response('',{status:404})).mockImplementation(async()=>Response.json({candidates:[{content:{parts:[{text}]}}]}));
  const handler=loadEdgeHandler(name,fetcher,{...base,GEMINI_API_KEY:'fixture-native',GEMINI_MODEL:'gemini-fixture-unavailable'},client);
  const response=await handler(request(name));const body=await response.json();
  expect(response.status).toBe(200);expect(body.reply||body.answer).toBe(panel.answer);expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[0][0])).toContain('/gemini-fixture-unavailable:generateContent');expect(String(fetcher.mock.calls[1][0])).toContain('/gemini-3.8-flash:generateContent');
 });
 it('uses the configured Lovable gateway when no native credential is supplied',async()=>{
  const text=name==='vv-chat'?panel.answer:JSON.stringify(panel);
  const fetcher=vi.fn(async(_input:unknown,_init?:RequestInit)=>Response.json({choices:[{message:{content:text}}]}));
  const response=await loadEdgeHandler(name,fetcher,{...base,LOVABLE_API_KEY:'fixture-gateway'},client)(request(name));
  const body=await response.json();expect(response.status).toBe(200);expect(body.reply||body.answer).toBe(panel.answer);expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toBe('https://ai.gateway.lovable.dev/v1/chat/completions');
 });
 it('returns an error without inventing a reply or retrying an ambiguous provider failure',async()=>{
  const fetcher=vi.fn(async()=>new Response('private upstream details',{status:500}));
  const response=await loadEdgeHandler(name,fetcher,{...base,GEMINI_API_KEY:'fixture-native'},client)(request(name));
  const body=await response.json();expect(response.status).toBe(502);expect(body.error).toBeTruthy();expect(body.reply).toBeUndefined();expect(body.answer).toBeUndefined();expect(JSON.stringify(body)).not.toContain('private upstream details');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('reports missing provider configuration without making an inference',async()=>{
  const fetcher=vi.fn();const response=await loadEdgeHandler(name,fetcher,base,client)(request(name));
  expect(response.status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
 });
});
