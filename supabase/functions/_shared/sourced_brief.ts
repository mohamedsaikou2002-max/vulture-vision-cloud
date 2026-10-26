import {getEnglishHeadline} from './english_headline.ts';
export interface BriefEvidence {id?:string;title:string;source?:string;canonical_url?:string;published_at?:string|null;fetched_at?:string;language?:string|null;translated_title_en?:string|null;translation_status?:string|null;}
/** A digest of observed reports, explicitly not AI interpretation or a numerical forecast. */
export function sourcedBrief(input:BriefEvidence[],now=Date.now()) {
 const seen=new Set<string>();
 const rows=input.flatMap(row=>{const title=getEnglishHeadline(row),time=Date.parse(row.published_at||'');
  if(!title||!Number.isFinite(time)||time>now+300000||time<now-72*3600000||!/^https?:\/\//.test(row.canonical_url||'')||seen.has(row.canonical_url!))return [];
  seen.add(row.canonical_url!);return [{...row,title}];
 }).sort((a,b)=>Date.parse(b.published_at!)-Date.parse(a.published_at!)).slice(0,12);
 if(!rows.length)return null;
 return {report_kind:'source_digest' as const,notice:'Source digest only. AI interpretation is not available in this report.',brief_id:rows[0].id||rows[0].canonical_url!,generated_at:new Date(now).toISOString(),cycle_type:'scheduled' as const,thesis:rows.slice(0,5).map(n=>`${n.source||'Publisher'}: ${n.title}`).join('\n'),thesis_confidence:0,regime_assessment:{current_regime:'unavailable',regime_summary:'Sourced news digest; no calibrated regime prediction.',transition_watch:''},supporting_signals:rows.map(n=>({signal:n.title,source:n.source||'Publisher',url:n.canonical_url!,ticker_impact:[],direction:'neutral' as const,confidence:0,journalist_exclusive:false})),contradicting_signals:[],ticker_implications:[],regional_breakdown:{},alpha_alerts:[],morning_brief_headline:rows[0].title,overall_confidence:0};
}
