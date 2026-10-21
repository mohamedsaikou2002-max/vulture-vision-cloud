import { transferableAbortController } from 'node:util';
import { afterEach,beforeEach,it,expect,vi } from 'vitest';
import {loadMacroObservables} from '../../supabase/functions/_shared/autosim_data';
import {buildBaseline} from '../../supabase/functions/_shared/autosim_engine';
import {generateGemini} from '../../supabase/functions/_shared/gemini';
beforeEach(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterEach(()=>vi.unstubAllGlobals());
function csv(series:string){
 const values:Record<string,number>={VIXCLS:20,BAMLH0A0HYM2:4,T10Y2Y:.5,UNRATE:4,NFCI:-.3,UMCSENT:80,USACSCICP02STSAM:50};
 return 'observation_date,'+series+'\n'+Array.from({length:14},(_,i)=>{
  const date=new Date(Date.now()-(13-i)*86400000).toISOString().slice(0,10);
  return `${date},${values[series] ?? 100+i}`;
 }).join('\n');
}
it('retrieves all macro dimensions from the actual public CSV path without an API key',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=>undefined}});
 const fetcher=vi.fn(async(input:string|URL)=>{
  const url=new URL(String(input));expect(url.pathname).toBe('/graph/fredgraph.csv');
  return new Response(csv(url.searchParams.get('id')!));
 });vi.stubGlobal('fetch',fetcher);
 const result=await loadMacroObservables();
 expect(result.status).toHaveLength(8);expect(result.status.every(s=>s.ok)).toBe(true);
 expect(buildBaseline(result.obs).neutral).toEqual([]);
 expect(fetcher).toHaveBeenCalledTimes(8);
});
it('recovers from a rejected FRED key through public data and retains source dates',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test-invalid-key'}});
 vi.stubGlobal('fetch',vi.fn(async(input:string|URL)=>{
  const url=new URL(String(input));
  if(url.hostname==='api.stlouisfed.org')return new Response('',{status:400});
  return new Response(csv(url.searchParams.get('id')!));
 }));
 const result=await loadMacroObservables();expect(result.status.every(s=>s.ok)).toBe(true);
 expect(result.obs.unrate?.source).toBe('FRED:UNRATE');expect(result.obs.unrate?.observed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
it('uses the current Gemini default without legacy thinking controls',async()=>{
 const fetcher=vi.fn(async()=>Response.json({candidates:[{content:{parts:[{text:'{"summary":"Dated observations"}'}]}}]}));
 await generateGemini('fixture',undefined,{generationConfig:{responseMimeType:'application/json',maxOutputTokens:1400}},fetcher);
 const args=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(args[0]).toContain('/gemini-3.8-flash:generateContent');
 expect(JSON.parse(String(args[1].body)).generationConfig).toEqual({maxOutputTokens:1400,responseMimeType:'application/json'});
});
it('falls back from a legacy model only after 404 and returns the real current-model answer',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(Response.json({candidates:[{content:{parts:[{text:'{"summary":"Actual provider answer"}'}]}}]}));
 const result=await generateGemini('fixture','gemini-2.5-flash',{generationConfig:{responseMimeType:'application/json',maxOutputTokens:1400}},fetcher);
 expect(result).toEqual({model:'gemini-3.8-flash',text:'{"summary":"Actual provider answer"}'});
 expect(fetcher).toHaveBeenCalledTimes(2);
 expect(JSON.parse(String(fetcher.mock.calls[0][1].body)).generationConfig.thinkingConfig).toEqual({thinkingBudget:0});
 expect(String(fetcher.mock.calls[1][0])).toContain('/gemini-3.8-flash:generateContent');
 expect(JSON.parse(String(fetcher.mock.calls[1][1].body)).generationConfig.thinkingConfig).toBeUndefined();
});
it('reports credential rejection distinctly and does not retry it with other models',async()=>{
 const fetcher=vi.fn(async()=>new Response('private-provider-details',{status:403}));
 await expect(generateGemini('fixture',undefined,{},fetcher)).rejects.toThrow('server credential or model access');
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not call a network failure a timeout',async()=>{
 const fetcher=vi.fn(async()=>{throw new Error('private-proxy-detail');});
 await expect(generateGemini('fixture',undefined,{},fetcher)).rejects.toThrow('provider connection unavailable');
});

it('uses fresh OECD consumer confidence when the Michigan series is stale, without changing its date',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=>undefined}});
 vi.stubGlobal('fetch',vi.fn(async(input:string|URL)=>{
  const series=new URL(String(input)).searchParams.get('id')!;
  if(series==='UMCSENT')return new Response('observation_date,UMCSENT\n2020-01-01,80');
  return new Response(csv(series));
 }));
 const result=await loadMacroObservables();
 expect(result.obs.umcsent).toBeUndefined();
 expect(result.obs.consumer_confidence_balance?.source).toContain('OECD');
 expect(result.status.find(s=>s.id==='fred:USACSCICP02STSAM')?.ok).toBe(true);
 const baseline=buildBaseline(result.obs);expect(baseline.neutral).not.toContain('trust');
 expect(baseline.detail.trust.source).toContain('percentage balance');
});
