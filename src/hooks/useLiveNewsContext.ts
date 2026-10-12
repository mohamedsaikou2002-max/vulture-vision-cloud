import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LiveNewsContext } from '../../supabase/functions/_shared/live_context';
export function useLiveNewsContext() {
  const [context,setContext]=useState<LiveNewsContext|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'waiting'|'unavailable'>('loading');
  const [version,setVersion]=useState<number|null>(null);
  const active=useRef(false);
  const lastVersion=useRef(0);
  const reload=useCallback(async()=>{
    const {data,error}=await (supabase as SupabaseClient).from('news_prompt_versions').select('version,context').order('version',{ascending:false}).limit(1);
    if(!active.current)return;
    if(error){setStatus('unavailable');return;}
    const row=(data as unknown as {version:number;context:LiveNewsContext}[]|null)?.[0];
    if(!row){setStatus('waiting');return;}
    if(row.version < lastVersion.current)return;
    lastVersion.current=row.version;
    setContext(row.context);setVersion(row.version);setStatus('ready');
  },[]);
  useEffect(()=>{
    active.current=true;
    const refresh=()=>{if(active.current)void reload();};refresh();
    const channel=supabase.channel('live-news-context').on('postgres_changes',{event:'INSERT',schema:'public',table:'news_prompt_versions'},refresh).subscribe();
    const timer=setInterval(refresh,15000);
    return()=>{active.current=false;clearInterval(timer);void supabase.removeChannel(channel);};
  },[reload]);
  return {context,status,version,reload};
}
