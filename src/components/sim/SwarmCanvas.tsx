import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { AGENTS, AGENT_RESPONSES, type Agent, type Dim } from '../../../supabase/functions/_shared/autosim_engine';
import type { AutoSimResult } from '@/lib/autoSimApi';
import { label } from './DimensionCanvas';
import { pct } from '@/lib/autosimFormat';

function positions(count:number,seed:number){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 return Array.from({length:count},(_,i)=>({id:i,group:AGENTS[i%AGENTS.length],x:3+random()*94,y:3+random()*94}));
}
export default function SwarmCanvas({result,count=500,onInspect}:{result:AutoSimResult|null;count?:number;onInspect:(agent:Agent)=>void}){
 const [day,setDay]=useState(0),[playing,setPlaying]=useState(false),[selected,setSelected]=useState<Agent>('investors');
 const horizon=result?.horizon_days||0;
 const nodes=useMemo(()=>positions(count,result?.seed||4217),[count,result?.seed]);
 useEffect(()=>{setDay(result?.horizon_days||0);setPlaying(false);},[result]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setDay(old=>{if(old>=horizon){setPlaying(false);return old;}return old+1;}),800);return()=>clearInterval(timer);},[playing,horizon]);
 const exposure=useMemo(()=>Object.fromEntries(AGENTS.map(agent=>[agent,result?Object.entries(AGENT_RESPONSES[agent]).reduce((sum,[dim,weight])=>sum+weight*(result.dimensions.trajectory[dim as Dim][day]-result.state.baseline[dim as Dim]),0):0])) as Record<Agent,number>,[result,day]);
 const color=(value:number)=>value>.005?'#61c48b':value<-.005?'#da7373':'#b49a58';
 return <section className="swarm-reactor" aria-label="Socioeconomic swarm">
  <div className="swarm-stage">
   <div className="swarm-stage-label"><span>SWARM · NASDAQ</span><span>{result?`DAY ${day} / ${horizon}`:'DORMANT'}</span></div>
   <svg viewBox="0 0 100 100" role="img" aria-label={`${count} representative nodes across ${AGENTS.length} socioeconomic cohorts`}>
    <title>Economic actor exposure to the simulated Nasdaq scenario</title>
    {nodes.map(node=><circle key={node.id} cx={node.x} cy={node.y} r={count>700?.35:.55} fill={result?color(exposure[node.group]):'#727280'} opacity={selected===node.group?1:.48} onClick={()=>setSelected(node.group)}><title>{label(node.group)} · {result?pct(exposure[node.group],2):'awaiting scenario'}</title></circle>)}
   </svg>
   <div className="swarm-stage-caption"><span>{count.toLocaleString()} REPRESENTATIVES</span><span>{AGENTS.length} MODELED COHORTS</span></div>
  </div>
  <div className="swarm-controls">
   <button disabled={!result} onClick={()=>{if(day===horizon)setDay(0);setPlaying(v=>!v);}}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'Pause replay':'Auto replay'}</button>
   <button disabled={!result||day>=horizon} onClick={()=>{setPlaying(false);setDay(d=>Math.min(horizon,d+1));}}><SkipForward size={13}/> Next day</button>
   <button disabled={!result} onClick={()=>{setPlaying(false);setDay(0);}}><RotateCcw size={13}/> Reset view</button>
  </div>
  <label className="swarm-scrubber">SIMULATED DAY <input type="range" min={0} max={Math.max(1,horizon)} value={day} disabled={!result} onChange={e=>{setPlaying(false);setDay(Number(e.target.value));}}/><span>{day}/{horizon||'—'}</span></label>
  <div className="swarm-stats"><span><i style={{background:'#61c48b'}}/>Expansionary exposure</span><span><i style={{background:'#da7373'}}/>Contractionary exposure</span><span><i style={{background:'#b49a58'}}/>Limited change</span></div>
  <div className="swarm-cohorts" aria-label="Socioeconomic cohorts">{AGENTS.map(agent=><button key={agent} aria-pressed={selected===agent} onClick={()=>setSelected(agent)}>{label(agent)}<span>{result?pct(exposure[agent],1):'—'}</span></button>)}</div>
  <div className="swarm-selection"><div><h3>{label(selected)}</h3><p>Exposure to liquidity, credit, inflation, employment and policy transmission.</p></div><button disabled={!result} onClick={()=>onInspect(selected)}>Interrogate cohort ↗</button></div>
  <p className="sim-fine">Each dot represents a cohort sample, not an independently simulated person. Replay derives cohort exposure from the model’s daily dimension means and response coefficients. No new API calls or simulation runs occur during replay.</p>
 </section>;
}
