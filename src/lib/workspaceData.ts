import { fetchWorldState } from './autoSimApi';
import { supabase } from '@/integrations/supabase/client';
import type { IntelBrief } from './intelApi';
import type { SocioFull } from './socioApi';

let world: ReturnType<typeof fetchWorldState> | null=null, expires=0;
export function currentWorld(){
  if(!world || Date.now()>expires){expires=Date.now()+30000;world=fetchWorldState().catch(e=>{world=null;throw e;});}
  return world;
}
export async function observedSocio():Promise<SocioFull>{
  const state=await currentWorld();
  const signals:Record<string,number>={}, explanations:Record<string,string[]>={};
  for(const [dim,detail] of Object.entries(state.detail)){
    if(state.neutral_dimensions.includes(dim as never))continue;
    const key=dim==='consumer_activity'?'consumer':dim==='default_risk'?'default':dim;
    signals[key]=detail.value;explanations[key]=[`${detail.source} · ${detail.observed_at || 'date unavailable'} · normalized model dimension, not a direct measurement`];
  }
  return {observations:state.observations,signals,confidence:{},graph_updates:{version:0,prior_version:0},explanations,narrative:'Nasdaq Composite (^IXIC) daily closes and returns from Yahoo Finance, alongside available dated economic observations. Normalized dimensions are derived estimates; unavailable inputs are omitted. No measured psychological state or calibrated event probabilities are available.',metadata:{timestamp:state.as_of,sources:state.data_status.filter(s=>s.ok).map(s=>s.id)},telemetry:{mode:'observations_only'}};
}
/** A current sourced digest when the optional independent synthesis service is absent. */
export async function indexedBrief():Promise<IntelBrief|null>{
  const {data,error}=await supabase.from('news_articles').select('id,title,source,canonical_url,published_at,fetched_at').gte('fetched_at',new Date(Date.now()-48*3600000).toISOString()).gte('published_at',new Date(Date.now()-24*3600000).toISOString()).order('published_at',{ascending:false}).limit(12).abortSignal(AbortSignal.timeout(8000));
  if(error||!data?.length)return null;
  const rows=data.filter(n=>Date.parse(n.published_at!)<=Date.now()+300000);
  if(!rows.length)return null;
  return {brief_id:rows[0].id,generated_at:rows[0].fetched_at,cycle_type:'scheduled',thesis:rows.map(n=>`${n.source}: ${n.title}`).join('\n'),thesis_confidence:0,regime_assessment:{current_regime:'unavailable',regime_summary:'Sourced news digest; no calibrated regime prediction.',transition_watch:''},supporting_signals:rows.map(n=>({signal:n.title,source:n.source,url:n.canonical_url,ticker_impact:[],direction:'neutral',confidence:0,journalist_exclusive:false})),contradicting_signals:[],ticker_implications:[],regional_breakdown:{},alpha_alerts:[],morning_brief_headline:rows[0].title,overall_confidence:0};
}
