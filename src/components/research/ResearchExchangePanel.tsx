import {useState} from "react";
import {DARPA_SOURCES,parseResearchEnvelope,type ResearchEnvelope,type ResearchSource} from "@/lib/research/exchange";
import {createExampleResearchArtifact} from "@/lib/research/samples";

/** Local-only inspector for sanitized, aggregate-only outputs from isolated research workers. */
export function ResearchExchangePanel({context}:{context:string}){
 const [value,setValue]=useState("");
 const [record,setRecord]=useState<ResearchEnvelope|null>(null);
 const [error,setError]=useState("");
 const [sampleSource,setSampleSource]=useState<ResearchSource>("macm");
 const loadSample=()=>{setValue(createExampleResearchArtifact(sampleSource));setRecord(null);setError("")};
 const parse=()=>{
  try{const result=parseResearchEnvelope(value);setRecord(result);setError("")}
  catch(e){setRecord(null);setError((e as Error).message)}
 };
 return <details className="my-4 rounded border border-white/20 bg-black/40 p-3 text-xs text-white">
  <summary className="cursor-pointer font-semibold">DARPA research exchange · {context} · 9 source adapters</summary>
  <p className="my-2 text-white/70">Import aggregate-only JSON from an isolated research worker. This does not run upstream engines. No identity, patient, or market record imports.</p>
  <div className="my-2 flex flex-wrap items-center gap-2">
   <label htmlFor="research-example-source">Synthetic example</label>
   <select id="research-example-source" aria-label="Research example source" value={sampleSource}
    onChange={e=>setSampleSource(e.target.value as ResearchSource)}
    className="rounded border border-white/30 bg-black px-2 py-1 text-white">
    {DARPA_SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
   </select>
   <button type="button" onClick={loadSample} className="rounded border border-white/30 px-3 py-1.5 hover:bg-white/10">Load synthetic sample</button>
   <span className="text-white/60">Fixture only · not an upstream engine result</span>
  </div>
  <div className="my-2 flex flex-wrap gap-2">{DARPA_SOURCES.map(s=>
   <span key={s.id} className="border border-white/30 px-2 py-1" title={s.license}>{s.label}</span>)}</div>
  <textarea className="w-full rounded border border-white/30 bg-transparent p-2 font-mono text-xs"
   aria-label="Paste research exchange JSON" rows={4} maxLength={40000}
   value={value} onChange={e=>{setValue(e.target.value);setRecord(null);setError("")}}
   placeholder='{"schema_version":"gc-research-exchange/1","source":"macm","upstream_version":"v1","scope":"synthetic","aggregates":{"events":10},"imported_status":"UNVERIFIED_EXTERNAL_RESULT"}' />
  <button type="button" onClick={parse} disabled={!value.trim()} className="mt-2 border border-white/30 px-3 py-1.5 disabled:opacity-50">Validate locally</button>
  {error&&<p role="alert" className="mt-2 text-white">{error}</p>}
  {record&&<div role="status" className="mt-2 border-t border-white/20 pt-2">
   <p className="font-bold">{record.source.toUpperCase()} · UNVERIFIED EXTERNAL RESULT · {record.scope}</p>
   <p>Source version: {record.upstream_version}</p>
   <p className="font-mono">{Object.entries(record.aggregates).map(([k,v])=>k+" = "+v).join(" · ")}</p>
   <p className="text-white/60">Metrics are supplied, not independently replicated or calibrated. Confirm provenance before using in reports.</p>
  </div>}
 </details>
}
