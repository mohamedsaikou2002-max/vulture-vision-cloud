import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
export default function RecentNews(){
 const [news,setNews]=useState<{id:string;title:string;translated_title_en?:string|null;translation_status?:string|null;language?:string|null;source:string;published_at:string|null}[]>([]),[error,setError]=useState('');
 useEffect(()=>{
  let active=true,running=false;
  const load=async()=>{if(running)return;running=true;try{
   const {data,error}=await supabase.from('news_articles').select('id,title,translated_title_en,translation_status,language,source,published_at').gte('fetched_at',new Date(Date.now()-48*3600000).toISOString()).gte('published_at',new Date(Date.now()-24*3600000).toISOString()).order('published_at',{ascending:false}).limit(12).abortSignal(AbortSignal.timeout(8000));
   if(active){if(error)setError('Indexed news is unavailable.');else{setNews((data||[]).filter(n=>Date.parse(n.published_at!)<=Date.now()+300000 && (Boolean(n.translated_title_en?.trim()) || n.translation_status==='original_english' || /^(en)(-|$)/i.test(n.language||''))));setError('');}}
  }catch{if(active)setError('Indexed news is unavailable.');}finally{running=false;}};
  void load();const timer=setInterval(()=>void load(),60000);
  const channel=supabase.channel('sim-recent-news').on('postgres_changes',{event:'INSERT',schema:'public',table:'news_articles'},()=>void load()).subscribe();
  return()=>{active=false;clearInterval(timer);void supabase.removeChannel(channel);};
 },[]);
 return <section className="panel sim-card"><h2 className="panel-title">Latest reported developments</h2><p className="sim-fine">Dated headlines from the backend index. Select one to explore a hypothetical scenario.</p>{error&&<p role="status" className="sim-note">{error}</p>}<ul className="sim-news">{news.map(n=><li key={n.id}><Link to={'/simulations?'+new URLSearchParams({scenario:'Explore the consequences of: '+n.title,articles:n.id})}>{n.translated_title_en?.trim() || n.title}</Link><p>{n.source} · {n.published_at?new Date(n.published_at).toLocaleString():''}</p></li>)}</ul>{!news.length&&!error&&<p className="sim-note">No recent indexed headlines.</p>}<Link className="sim-link" to="/news">Browse all collected news ↗</Link></section>;
}
