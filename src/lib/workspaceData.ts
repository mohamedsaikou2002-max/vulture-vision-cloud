import {sourcedBrief} from '../../supabase/functions/_shared/sourced_brief';
import { fetchWorldState } from './autoSimApi';
import { supabase } from '@/integrations/supabase/client';
import type { IntelBrief } from './intelApi';

let world: ReturnType<typeof fetchWorldState> | null=null, expires=0;
export function currentWorld(){
  if(!world || Date.now()>expires){expires=Date.now()+30000;world=fetchWorldState().catch(e=>{world=null;throw e;});}
  return world;
}
/** A current sourced digest when the optional independent synthesis service is absent. */
export async function indexedBrief():Promise<IntelBrief|null>{
  const {data,error}=await supabase.from('news_articles').select('*').gte('fetched_at',new Date(Date.now()-48*3600000).toISOString()).gte('published_at',new Date(Date.now()-24*3600000).toISOString()).order('published_at',{ascending:false}).limit(12).abortSignal(AbortSignal.timeout(8000));
  if(error||!data?.length)return null;
  return sourcedBrief(data);
}
