import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LiveNewsContext } from '../../supabase/functions/_shared/live_context';
export function useLiveNewsContext() {
  const [context,setContext]=useState<LiveNewsContext|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'waiting'|'unavailable'>('loading');
  const [version,setVersion]=useState<number|null>(null);
  const [workerStatus,setWorkerStatus]=useState('unknown');
  const active=useRef(false);
  const lastVersion=useRef(0);
  const reload=useCallback(async()=>{
    try {
      const signal = AbortSignal.timeout(8000);
      const [{data:worker,error:workerError}, {data,error}] = await Promise.all([
        (supabase as SupabaseClient).rpc('news_context_status').abortSignal(signal),
        (supabase as SupabaseClient).from('news_prompt_versions').select('version,context').order('version',{ascending:false}).limit(1).abortSignal(signal),
      ]);
      if(!active.current)return;
      setWorkerStatus(workerError?'unavailable':worker?.status || 'unknown');
      if(error){setStatus('unavailable');return;}
      const row=(data as unknown as {version:number;context:LiveNewsContext}[]|null)?.[0];
      if(!row){setStatus('waiting');return;}
      if(row.version < lastVersion.current)return;
      lastVersion.current=row.version;
      setContext(row.context);setVersion(row.version);setStatus('ready');
    } catch {
      if(active.current){setStatus('unavailable');setWorkerStatus('unavailable');}
    }
  },[]);
  useEffect(()=>{
    active.current=true;
    const refresh=()=>{if(active.current)void reload();};refresh();
    const channel=supabase.channel('live-news-context').on('postgres_changes',{event:'INSERT',schema:'public',table:'news_prompt_versions'},refresh).subscribe();
    const timer=setInterval(refresh,15000);
    return()=>{active.current=false;clearInterval(timer);void supabase.removeChannel(channel);};
  },[reload]);
  return {context,status,version,reload,workerStatus};
}
