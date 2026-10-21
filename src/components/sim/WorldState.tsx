import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pct } from '@/lib/autosimFormat';
import { DIMENSIONS } from '../../../supabase/functions/_shared/autosim_engine';
import { fetchWorldState } from '@/lib/autoSimApi';
import { label } from './DimensionCanvas';
type WS = Awaited<ReturnType<typeof fetchWorldState>>;
export default function WorldState({compact=false}:{compact?:boolean}) {
  const [ws,setWs]=useState<WS|null>(null), [err,setErr]=useState(''), [loading,setLoading]=useState(false);
  const active=useRef(false);
  const load=useCallback(async()=>{
    setLoading(true);
    try { const next=await fetchWorldState(); if(active.current){setWs(next);setErr('');} }
    catch(e){if(active.current)setErr(e instanceof Error?e.message:'World state unavailable');}
    finally{if(active.current)setLoading(false);}
  },[]);
  useEffect(()=>{active.current=true;void load();const timer=setInterval(()=>void load(),60000);return()=>{active.current=false;clearInterval(timer);};},[load]);
  const pulse=ws?.world_pulse;
  return <div>
    <Button variant="ghost" className="sim-mini" onClick={()=>void load()} disabled={loading} aria-label="Refresh world state">{loading?'Refreshing…':'Refresh world state'}</Button>
    {err && <p role="alert" className="sim-note sim-warn">World state unavailable: {err}{ws?' Showing the last available snapshot.':''}</p>}
    {!ws && !err && <p role="status" className="sim-note">Reading dated market observations…</p>}
    {ws && <>
      <p className="sim-note">{DIMENSIONS.length-ws.neutral_dimensions.length} of {DIMENSIONS.length} dimensions have fresh observations; {ws.neutral_dimensions.length} use neutral defaults.</p>
      <p className="sim-fine">Fetched {new Date(ws.as_of).toLocaleString()}. Each observation retains its own date.</p>
      {pulse && <section className="world-pulse" aria-label="World market pulse">
        <h3 className="sim-h3">World economic pulse</h3>
        <div className="sim-sources"><span className="sim-chip">Shock {pulse.shock_level===null?'unavailable':pct(pulse.shock_level, 0)}</span><span className="sim-chip">Market mood: {pulse.world_mood}</span><span className="sim-chip">{pulse.status}</span></div>
        <p className="sim-fine">{pulse.note}</p>
        <ul className="sim-news">{pulse.top_shocks.map(h=><li key={h.url}><a href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a><p>{h.source} · {h.published_at?new Date(h.published_at).toLocaleString():'Publication time unknown'}</p></li>)}</ul>
        {!pulse.top_shocks.length && <p className="sim-note">No recent indexed headlines are available for this snapshot.</p>}
      </section>}
      <details className="world-details" open={!compact}><summary>Economic observations & dimensions</summary>
      {!!Object.keys(ws.observations||{}).length && <section aria-label="Dated market measurements"><h3 className="sim-h3">Observed market data</h3><ul className="sim-news">{Object.entries(ws.observations||{}).map(([id,o])=><li key={id}>{id.replace(/_/g,' ')}: {['cpi_yoy','retail_yoy','market_vol_ann','nasdaq_daily_return','nasdaq_20_session_return'].includes(id)?pct(o.value,2):o.value.toFixed(2)}<p>{o.source} · {o.observed_at}</p></li>)}</ul></section>}
      <p className="sim-fine">Normalized model dimensions below are derived estimates, not direct measurements.</p>
      <div className="sim-dims">{DIMENSIONS.map(d=><div key={d} className="sim-dim" title={`${ws.detail[d].source}${ws.detail[d].observed_at?' · '+ws.detail[d].observed_at:''}`}><span>{label(d)}</span><div className="sim-track"><div style={{width:`${ws.baseline[d]*100}%`}} className={ws.detail[d].source==='neutral_default'?'sim-fill dim':'sim-fill'}/></div><b>{ws.neutral_dimensions.includes(d)?"—":pct(ws.baseline[d], 0)}</b></div>)}</div>
      </details>
      <div className="sim-sources">{ws.data_status.map(s=><span key={s.id} className={s.ok?'sim-chip ok':'sim-chip bad'} title={s.detail}>{s.id.replace('fred:','')}</span>)}</div>
    </>}
  </div>;
}
