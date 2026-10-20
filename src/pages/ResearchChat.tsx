import {useRef,useState} from 'react';
import VVLayout from '@/components/VVLayout';
import {askSimulationResearch} from '@/lib/simulationChatApi';
import type {SimulationChatAnswer} from '../../supabase/functions/_shared/simulation_chat_contract';
export default function ResearchChat(){
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [history,setHistory]=useState<{question:string;response:SimulationChatAnswer}[]>([]);const active=useRef(false);
 const send=async()=>{if(active.current||!input.trim())return;active.current=true;setBusy(true);setError('');const question=input.trim();try{
  const response=await askSimulationResearch({question,scenario:question,mode:'panel',history:history.slice(-3).flatMap(t=>[{role:'user' as const,content:t.question.slice(0,1200)},{role:'assistant' as const,content:t.response.answer.slice(0,1200)}]),contextSummary:'No live source evidence attached. Treat this as hypothetical economic research.',asOf:new Date().toISOString(),news:[],report:'',runStatus:'not_started',round:0});
  setHistory(h=>[...h,{question,response}]);setInput('');
 }catch(e){setError(e instanceof Error?e.message:'Research is unavailable');}finally{active.current=false;setBusy(false);}};
 return <VVLayout><section className="simple-sim research-chat"><span className="room-eyebrow">RESEARCH CHAT</span><h1>Challenge your thesis.</h1><p>Compare synthetic bull, bear, macro and risk perspectives. Replies use the shared research quota. No live evidence is attached to this standalone conversation.</p><div role="log" aria-label="Research conversation" aria-live="polite">{history.map((t,i)=><article className="panel p-5 mb-4" key={i}><h2>{t.question}</h2><p>{t.response.answer}</p>{t.response.specialists.map(s=><div key={s.role}><h3>{s.role}: {s.position}</h3><p>{s.reasoning}</p></div>)}{t.response.missing_evidence.length>0&&<p>Missing evidence: {t.response.missing_evidence.join('; ')}</p>}<small>AI research · {t.response.model}</small></article>)}</div><form onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="research-question">Research question</label><textarea id="research-question" value={input} onChange={e=>setInput(e.target.value)} maxLength={1500} required disabled={busy}/><button className="simple-submit" disabled={busy||!input.trim()}>{busy?'Researching…':'Ask the research panel'}</button></form>{error&&<p role="alert">{error}</p>}</section></VVLayout>;
}
