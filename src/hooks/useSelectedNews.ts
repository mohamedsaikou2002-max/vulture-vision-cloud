import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { NewsEvidence } from '../../supabase/functions/_shared/scenario_contract';
export function useSelectedNews(ids: string[]) {
  const key=[...new Set(ids)].sort().join(',');
  const [state,setState]=useState<{news:NewsEvidence[];status:'loading'|'ready'|'error';error:string}>({news:[],status:'loading',error:''});
  useEffect(()=>{
    let active=true;const wanted=key?key.split(','):[];
    if(!wanted.length){setState({news:[],status:'ready',error:''});return;}
    if(wanted.length>8 || wanted.some(id=>!/^[a-f0-9]{64}$/.test(id))){setState({news:[],status:'error',error:'Invalid selected story.'});return;}
    setState({news:[],status:'loading',error:''});
    void (async()=>{
      const cutoff=new Date(Date.now()-24*3600_000).toISOString();
      const {data,error}=await (supabase as SupabaseClient).from('news_articles').select('id,title,source,canonical_url,source_country,language,published_at,fetched_at').in('id',wanted).gte('published_at',cutoff).gte('fetched_at',cutoff);
      if(!active)return;
      if(error || data?.length!==wanted.length){setState({news:[],status:'error',error:'Selected news is missing or stale. Choose recent news.'});return;}
      setState({news:data as NewsEvidence[],status:'ready',error:''});
    })();
    return()=>{active=false;};
  },[key]);
  return state;
}
