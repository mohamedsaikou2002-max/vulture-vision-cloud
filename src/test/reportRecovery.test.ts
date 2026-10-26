import {it,expect,vi} from 'vitest';
import {sourcedBrief} from '../../supabase/functions/_shared/sourced_brief';
import {getEnglishHeadline} from '../../supabase/functions/_shared/english_headline';
import {loadEdgeHandler} from './helpers/edgeHarness';
const row={id:'evidence',title:'Nasdaq funding conditions change',language:'en',source:'Publisher',canonical_url:'https://example.com/news',published_at:new Date().toISOString()};
it('labels a sourced report honestly, excludes stale/foreign/unlinked evidence and deduplicates',()=>{
 const b=sourcedBrief([row,row,{...row,canonical_url:'https://example.com/old',published_at:'2000-01-01'},{...row,canonical_url:'https://example.com/foreign',language:'es',title:'El banco sube tipos'},{...row,canonical_url:'javascript:alert(1)'}])!;
 expect(b.report_kind).toBe('source_digest');expect(b.overall_confidence).toBe(0);expect(b.supporting_signals).toHaveLength(1);
 expect(getEnglishHeadline({...row,language:'es',translated_title_en:'Rates rise'})).toBe('Rates rise');
});
it('returns an available sourced report when the AI cache is unavailable',async()=>{
 const query=(table:string)=>{const q={select:()=>q,eq:()=>q,gte:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,then:(done:(x:unknown)=>unknown)=>Promise.resolve(table==='warm_state'?{data:null,error:{message:'unavailable'}}:{data:[row],error:null}).then(done)};return q;};
 const response=await loadEdgeHandler('vv-intel-brief',vi.fn(),{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture'},()=>({from:query}))(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'latest'})}));
 expect(response.status).toBe(200);expect((await response.json()).brief.report_kind).toBe('source_digest');
});
it('keeps source reporting available without AI configuration and does not call a provider',async()=>{
 const query=()=>{const q={select:()=>q,gte:()=>q,order:()=>q,limit:()=>q,eq:()=>q,maybeSingle:()=>q,then:(done:(x:unknown)=>unknown)=>Promise.resolve({data:[row],error:null}).then(done)};return q;};
 const network=vi.fn();const response=await loadEdgeHandler('vv-intel-brief',network,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture'},()=>({from:query}))(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'generate'})}));
 expect(response.status).toBe(200);const data=await response.json();expect(data.brief.report_kind).toBe('source_digest');expect(data.ai_status).toBe('not_configured');expect(network).not.toHaveBeenCalled();
});
