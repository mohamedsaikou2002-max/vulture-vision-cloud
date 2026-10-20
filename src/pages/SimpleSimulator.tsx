import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import VVLayout from '@/components/VVLayout';
import {ApiError,runSimulation,loadJob,jobStatus,type AutoSimResult} from '@/lib/autoSimApi';
import {pct} from '@/lib/autosimFormat';
export default function SimpleSimulator(){
 const [scenario,setScenario]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<AutoSimResult|null>(null),[pending,setPending]=useState<string|null>(null);
 const active=useRef(false);
 const payload=useRef<Parameters<typeof runSimulation>[0]|null>(null);
 const run=async()=>{if(active.current)return;active.current=true;setBusy(true);setError('');
  try{
   if(pending){const state=await jobStatus(pending);if(state==='completed'){const value=await loadJob(pending);if(value){setResult(value);setPending(null);return;}}if(state===null&&payload.current?.job_id===pending){const response=await runSimulation(payload.current);setResult(response.result);setPending(null);return;}if(state==='failed'||state==='cancelled'){setPending(null);throw new Error('The previous run failed. You can start again.');}throw new Error('Your previous run is still unconfirmed. Check again before starting another.');}
   const id=crypto.randomUUID();payload.current={job_id:id,scenario:scenario.trim(),constraints:{horizon_days:7,risk_profile:'conservative'}};try{const response=await runSimulation(payload.current);setResult(response.result);}catch(e){if(e instanceof ApiError&&['network','timeout'].includes(e.code))setPending(id);throw e;}
  }catch(e){setError(e instanceof Error?e.message:'Simulation unavailable');}finally{active.current=false;setBusy(false);}
 };
 const returns=result?.strategies.buy_hold_scenario;
 return <VVLayout><section className="simple-sim"><span className="room-eyebrow">QUICK NASDAQ RESEARCH</span><h1>What could happen next?</h1><p>Describe one event. Explore a seven-day Nasdaq scenario using conservative execution settings.</p><label htmlFor="simple-scenario">What happens?</label><textarea id="simple-scenario" value={scenario} onChange={e=>setScenario(e.target.value)} maxLength={2000} disabled={busy||!!pending} placeholder="Interest rates rise unexpectedly…"/><button className="simple-submit" disabled={busy||(!pending&&scenario.trim().length<8)} onClick={()=>void run()}>{busy?'Running…':pending?'Check pending run':'Explore this scenario'}</button>{error&&<p role="alert">{error}</p>}
 {result&&<section className="simple-results"><h2>{result.analysis?.headline||'Simulated Nasdaq outcomes'}</h2><p>{result.scenario}</p><div className="simple-cards">{[['Lower range',returns?.p5_return],['Middle range',returns?.median_return],['Upper range',returns?.p95_return]].map(([name,value])=><article key={String(name)}><span>{name}</span><strong>{pct(value as number,1)}</strong></article>)}</div><p>{result.analysis?.summary}</p>{result.warnings.length>0&&<details><summary>Data limits and assumptions</summary>{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}<small>Simulated buy-and-hold range, not a price prediction or guarantee. This uses the same quota and engine as the Pod Room.</small></section>}
 <Link to="/simulations">Open the full socioeconomic swarm ↗</Link></section></VVLayout>;
}
