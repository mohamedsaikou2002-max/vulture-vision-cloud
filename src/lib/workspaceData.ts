import { fetchWorldState } from './autoSimApi';
import { supabase } from '@/integrations/supabase/client';
import type { IntelBrief } from './intelApi';

let world: ReturnType<typeof fetchWorldState> | null=null, expires=0;
export function currentWorld(){
  if(!world || Date.now()>expires){expires=Date.now()+30000;world=fetchWorldState().catch(e=>{world=null;throw e;});}
  return world;
}
/** A current sourced digest when the optional independent synthesis service is absent. */
export async function indexedBrief():Promise<IntelBrief|null>{
  const {data,error}=await supabase.from('news_articles').select('id,title,translated_title_en,source,canonical_url,published_at,fetched_at').gte('fetched_at',new Date(Date.now()-48*3600000).toISOString()).gte('published_at',new Date(Date.now()-24*3600000).toISOString()).order('published_at',{ascending:false}).limit(12).abortSignal(AbortSignal.timeout(8000));
  if(error||!data?.length)return null;
  const rows=data.map(n=>({...n,title:n.translated_title_en?"[English translation] "+n.translated_title_en:n.title})).filter(n=>Date.parse(n.published_at!)<=Date.now()+300000);
  if(!rows.length)return null;
  return {brief_id:rows[0].id,generated_at:rows[0].fetched_at,cycle_type:'scheduled',thesis:rows.slice(0,5).map(n=>`${n.source}: ${n.title}`).join('\n'),thesis_confidence:0,regime_assessment:{current_regime:'unavailable',regime_summary:'Sourced news digest; no calibrated regime prediction.',transition_watch:''},supporting_signals:rows.map(n=>({signal:n.title,source:n.source,url:n.canonical_url,ticker_impact:[],direction:'neutral',confidence:0,journalist_exclusive:false})),contradicting_signals:[],ticker_implications:[],regional_breakdown:{},alpha_alerts:[],morning_brief_headline:rows[0].title,overall_confidence:0};
}
