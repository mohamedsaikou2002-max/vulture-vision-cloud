import { sourceCatalog } from './source_catalog.ts';
import { robotsAllowed, structuredHeadlines, publicAddress } from './catalog_rules.ts';
import { parseRss, publicationTime } from '../_shared/news_feed.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AGENT = 'VultureVisionNewsBot/0.1';
const BATCH = 16;
const MAX_BYTES = 1_500_000;
type Health = {source: string; status: string; count: number; checked_at?: string};
type State = {cursor: number; last_attempt: number; health: Record<string,Health>};
export async function collectCatalog(req: Request, signal: AbortSignal): Promise<Health[]> {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return [];
  const db = createClient(url,key);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
  if (token !== key) {const {data:{user},error} = await db.auth.getUser(token); if (error || !user) return [];}
  const {data: saved, error: readError} = await db.from('warm_state').select('value').eq('key','news_catalog_collection').maybeSingle();
  if (readError) return [{source:'Cloud publisher collection',status:'unavailable',count:0}];
  const state: State = saved?.value ?? {cursor: 0,last_attempt: 0,health: {}};
  if (Date.now()-state.last_attempt < 60000) return sourceCatalog.map(s=>state.health[s.id] ?? {source:s.name,status:'waiting',count:0});
  const previousAttempt = state.last_attempt;
  const start = state.cursor % sourceCatalog.length;
  state.cursor = (start + BATCH) % sourceCatalog.length; state.last_attempt = Date.now();
  const reservation = saved
    ? await db.from('warm_state').update({value:state}).eq('key','news_catalog_collection').eq('value->>last_attempt',String(previousAttempt)).select('key')
    : await db.from('warm_state').insert({key:'news_catalog_collection',value:state,expires_at:null}).select('key');
  if (reservation.error || !reservation.data?.length) return [{source:'Cloud publisher collection',status:'waiting',count:0}];
  await Promise.all(Array.from({length:BATCH},(_,i)=>sourceCatalog[(start+i)%sourceCatalog.length]).map(async source => {
    const hosts = new Set([source.homepage,...source.feed_urls].flatMap(u=>{const h=new URL(u).hostname; return [h,h.startsWith('www.')?h.slice(4):'www.'+h];}));
    for (const host of source.allowed_hosts) hosts.add(host);
    const policies = new Map<string,string>();
    async function validated(input: string) {
      const u = new URL(input);
      if (u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443') || !hosts.has(u.hostname)) throw new Error('restricted');
      const resolved = await Promise.allSettled([Deno.resolveDns(u.hostname,'A'),Deno.resolveDns(u.hostname,'AAAA')]);
      const addresses = resolved.flatMap(r=>r.status==='fulfilled'?r.value:[]);
      if (!addresses.length || addresses.some(ip=>!publicAddress(ip))) throw new Error('restricted');
      return u;
    }
    async function request(input:string, robots = false):Promise<{text:string;url:string}> {
      let target=input;
      for (let hop=0;hop<3;hop++) {
        const u = await validated(target);
        if (!robots) {
          if (!policies.has(u.origin)) policies.set(u.origin,(await request(u.origin+'/robots.txt',true)).text);
          if (!robotsAllowed(policies.get(u.origin) ?? '',u.pathname+u.search)) throw new Error('restricted');
        }
        const r=await fetch(u.href,{redirect:'manual',headers:{'User-Agent':AGENT},signal:AbortSignal.any([signal,AbortSignal.timeout(2500)])});
        if ([301,302,303,307,308].includes(r.status)) {target=new URL(r.headers.get('location') || '',u).href; await r.body?.cancel(); continue;}
        if (robots && [404,410].includes(r.status)) {await r.body?.cancel(); return {text:'',url:u.href};}
        if (!r.ok) {await r.body?.cancel();throw new Error([401,403,429].includes(r.status)?'restricted':'unavailable');}
        const reader=r.body?.getReader(); if (!reader) throw new Error('unavailable');
        const decoder=new TextDecoder(); let text='',size=0;
        try {while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES)throw new Error('restricted');text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();} finally {await reader.cancel();}
        return {text,url:u.href};
      }
      throw new Error('restricted');
    }
    try {
      const candidates: {title:string;link?:string;time?:string}[]=[];
      for (const feed of source.feed_urls.slice(0,1)) {try {const page=await request(feed); candidates.push(...parseRss(page.text,source.name,new URL(page.url).origin));} catch {/* Try permitted index metadata next. */}}
      if (!candidates.length) {
        const page=await request(source.homepage);
        const feeds=[...page.text.matchAll(/<link\b[^>]*>/gi)].filter(m=>/application\/(rss|atom)\+xml/i.test(m[0])).flatMap(m=>{const href=m[0].match(/href=["']([^"']+)["']/i)?.[1];return href?[new URL(href,page.url).href]:[];});
        if (feeds[0]) {try {const feed=await request(feeds[0]);candidates.push(...parseRss(feed.text,source.name));} catch {/* Keep structured index metadata only. */}}
        candidates.push(...structuredHeadlines(page.text,page.url));
      }
      const rows=[];
      for (const item of candidates.slice(0,15)) {
        if (!item.link || !item.title) continue;
        let canonical: URL;try {canonical=await validated(item.link);} catch {continue;}
        canonical.hash='';const time=publicationTime(item.time);
        if (time && (Date.parse(time)>Date.now()+300000 || Date.parse(time)<Date.now()-72*3600000)) continue;
        const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical.href)))).map(n=>n.toString(16).padStart(2,'0')).join('');
        rows.push({id,title:item.title.slice(0,600),source:source.name,canonical_url:canonical.href,published_at:time ?? null,fetched_at:new Date().toISOString(),source_country:source.source_country,language:source.language,source_id:source.id,ingestion_method:'publisher_metadata'});
      }
      if (rows.length) {const {error}=await db.from('news_articles').upsert([...new Map(rows.map(r=>[r.id,r])).values()],{onConflict:'id'});if(error)throw new Error('storage_unavailable');}
      state.health[source.id]={source:source.name,status:rows.length?'available':'empty',count:rows.length,checked_at:new Date().toISOString()};
    } catch (e) {state.health[source.id]={source:source.name,status:e instanceof Error && e.message==='restricted'?'restricted':'unavailable',count:0,checked_at:new Date().toISOString()};}
  }));
  await db.from('warm_state').update({value:state}).eq('key','news_catalog_collection').eq('value->>last_attempt',String(state.last_attempt));
  return sourceCatalog.map(s=>state.health[s.id] ?? {source:s.name,status:'waiting',count:0});
}