import { transferableAbortController } from 'node:util';
import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { loadEdgeHandler } from './helpers/edgeHarness';
import type { AutoSimResult } from '../../supabase/functions/_shared/autosim_types';
beforeAll(()=>vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor));
afterAll(()=>vi.unstubAllGlobals());
const user='00000000-0000-4000-8000-000000000000';
const job1='00000000-0000-4000-8000-000000000002',job2='00000000-0000-4000-8000-000000000003';
function fixture(malformed=false){
  const jobs=new Map<string,Record<string,unknown>>();
  const articles=[{id:'a'.repeat(64),title:'Related funding news',source:'Publisher',source_id:'p',source_country:'GB',canonical_url:'https://example.com/new',published_at:new Date().toISOString(),fetched_at:new Date().toISOString()}, {id:'b'.repeat(64),title:'Old funding news',source:'Old publisher',source_id:'old',source_country:'US',canonical_url:'https://example.com/old',published_at:'2000-01-01T00:00:00Z',fetched_at:new Date().toISOString()}];
  class Query {
    filters:[string,unknown][]=[];values:Record<string,unknown>|null=null;single=false;
    constructor(public table:string){}
    select(){return this;}order(){return this;}limit(){return this;}gte(){return this;}or(){return this;}abortSignal(){return this;}in(){return this;}
    eq(k:string,v:unknown){this.filters.push([k,v]);return this;}
    update(v:Record<string,unknown>){this.values=v;return this;}
    maybeSingle(){this.single=true;return this;}
    then(done:(value:{data:unknown;error:null})=>unknown){
      let rows:Record<string,unknown>[]=this.table==='public_workspace_jobs'?[...jobs.values()]:this.table==='news_articles'?articles:[];
      rows=rows.filter(row=>this.filters.every(([k,v])=>row[k]===v));
      if(this.values)for(const row of rows)Object.assign(row,this.values);
      return Promise.resolve({data:this.single?(rows[0]||null):rows,error:null}).then(done);
    }
  }
  const sb={auth:{getUser:async()=>({data:{user:{id:user}},error:null})},from:(table:string)=>new Query(table),rpc:async(name:string,args:Record<string,unknown>)=>{
    if(name==='vv_claim_public_autosim'){
      const id=String(args.p_job_id);if(jobs.has(id))return {data:'existing',error:null};
      jobs.set(id,{id,user_id:user,status:'queued',scenario:args.p_scenario});return {data:'claimed',error:null};
    }
    return {data:true,error:null};
  }};
  const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture',GEMINI_API_KEY:'fixture',GEMINI_MODEL:'gemini-configured',VV_DIM_PATHS:'3',VV_STRAT_PATHS:'3'};
  let priceOffset=0;
  const fetcher=vi.fn().mockImplementation(async(input:string|URL,init:RequestInit)=>{
    const url=String(input);
    if(url.includes('finance.yahoo.com/v8/finance/chart/')){
      const day=Math.floor(Date.now()/86400000)*86400;
      return Response.json({chart:{result:[{timestamp:Array.from({length:150},(_,i)=>day-(150-i)*86400),indicators:{quote:[{close:Array.from({length:150},(_,i)=>15000+i+priceOffset)}]}}]}});
    }
    if(url.includes('generativelanguage.googleapis.com')){
      const body=JSON.parse(String(init.body));const prompt=body.contents[0].parts[0].text;
      const data=prompt.includes('Return JSON: headline')?(malformed?{drivers:'bad scalar'}:{headline:'Derived research',summary:'A hypothetical stress test',drivers:['Funding conditions']}):{event_type:'liquidity_crunch',summary:'Assumed funding stress',is_hypothetical:false,horizon_days:3,asset:'BTC-USD',regions:[],sectors:[],search_keywords:['funding'],shocks:{liquidity:-.1},shock_rationale:{liquidity:'Funding pressure'},risk_profile:'balanced',confidence:.5};
      return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]});
    }
    return new Response('',{status:503});
  });
  const handler=loadEdgeHandler('vv-autosim',fetcher,env,()=>sb);
  const call=async(payload:Record<string,unknown>)=>{
    const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(payload)}));
    const data=await response.json();return {status:response.status,data};
  };
  return {call,fetcher,jobs,env,changePrice:()=>{priceOffset=500;}};
}
describe('AutoSim real handler and shared engine',()=>{
  it('freezes parent inputs and seed across controlled zero-shock variants',async()=>{
    const f=fixture();const initial=await f.call({action:'run',job_id:job1,scenario:'A funding liquidity crunch'});
    expect(initial.status).toBe(200);
    const base=initial.data.result as AutoSimResult;
    expect(base.market.asset).toBe('NASDAQ Composite');expect(base.interpretation.asset).toBe('NASDAQ Composite');expect(base.market.price_source).toBe('yahoo_nasdaq_daily_candles');
    f.changePrice();f.env.VV_DIM_PATHS='600';f.env.VV_STRAT_PATHS='200';f.env.VV_DEFAULT_FEE_BPS='50';f.fetcher.mockClear();
    const variant=await f.call({action:'run',job_id:job2,parent_job_id:job1,scenario:base.scenario,inject:{dimension:'liquidity',delta:0}});
    expect(variant.status).toBe(200);
    const result=variant.data.result as AutoSimResult;
    expect(result.seed).toBe(base.seed);expect(result.state).toEqual(base.state);
    expect(result.dimensions).toEqual(base.dimensions);expect(result.strategies).toEqual(base.strategies);
    expect(result.replay_spec).toEqual(base.replay_spec);
    expect(f.fetcher.mock.calls.some(c=>String(c[0]).includes('coinbase'))).toBe(false);
    expect(f.fetcher).toHaveBeenCalledTimes(1); // Explanation only; no reinterpretation or new observations.
  });
  it('rejects old publications and treats all user scenarios as assumptions',async()=>{
    const f=fixture();const r=await f.call({action:'run',job_id:job1,scenario:'A funding liquidity crunch'});
    expect(r.status).toBe(200);expect(r.data.result.evidence.selected.map((h:{title:string})=>h.title)).toEqual(['Related funding news']);
    expect(r.data.result.mode).toBe('hypothetical');expect(r.data.result.interpretation.is_hypothetical).toBe(true);
  });
  it('keeps numbers when AI explanation structure is invalid',async()=>{
    const r=await fixture(true).call({action:'run',job_id:job1,scenario:'A funding liquidity crunch'});
    expect(r.status).toBe(200);expect(r.data.result.analysis).toBeNull();expect(r.data.result.strategies.scenario).toHaveLength(6);
    expect(r.data.result.warnings.join(' ')).toContain('invalid structure');
  });
  it('enforces explicit horizon and risk constraints and keeps variants frozen',async()=>{
    const f=fixture();const root=await f.call({action:'run',job_id:job1,scenario:'A funding liquidity crunch',constraints:{horizon_days:7,risk_profile:'conservative'}});
    expect(root.status).toBe(200);expect(root.data.result.horizon_days).toBe(7);expect(root.data.result.interpretation.risk_profile).toBe('conservative');expect(root.data.result.execution.cost.leverage).toBeLessThanOrEqual(2);
    f.fetcher.mockClear();
    const variant=await f.call({action:'run',job_id:job2,parent_job_id:job1,scenario:'A funding liquidity crunch',constraints:{horizon_days:30,risk_profile:'aggressive'}});
    expect(variant.status).toBe(400);expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('uses the Belicia-style market pulse without invoking an ungrounded AI snapshot',async()=>{
    const f=fixture();const r=await f.call({action:'world_state'});
    expect(r.status).toBe(200);expect(r.data.world_pulse.kind).toBe('derived_market_snapshot');
    expect(r.data.observations.nasdaq_close.value).toBe(15149);
    expect(r.data.observations.nasdaq_daily_return.value).toBeCloseTo(15149/15148-1);
    expect(r.data.observations.nasdaq_close.source).toContain('^IXIC');
    expect(r.data.world_pulse.top_shocks[0].title).toBe('Related funding news');
    expect(r.data.world_pulse.top_shocks.some((h:{title:string})=>h.title==='Old funding news')).toBe(false);
    expect(f.fetcher.mock.calls.some(c=>String(c[0]).includes('generativelanguage'))).toBe(false);
  });
  it('uses configured Lovable AI credentials when no native Gemini key is bound',async()=>{
    const f=fixture();delete f.env.GEMINI_API_KEY;f.env.LOVABLE_API_KEY='gateway-fixture';
    const original=f.fetcher.getMockImplementation()!;
    f.fetcher.mockImplementation(async(input:string|URL,init:RequestInit)=>{
      if(String(input).includes('ai.gateway.lovable.dev')){
        const body=JSON.parse(String(init.body));
        const data=body.messages.at(-1).content.includes('Return JSON: headline')?{headline:'Gateway explanation',drivers:['Funding context']}:{event_type:'liquidity_crunch',horizon_days:3,asset:'NASDAQ Composite',search_keywords:['funding'],risk_profile:'balanced',confidence:.5};
        expect((init.headers as Record<string,string>).Authorization).toBe('Bearer gateway-fixture');
        return Response.json({choices:[{message:{content:JSON.stringify(data)}}]});
      }
      return original(input,init);
    });
    const r=await f.call({action:'run',job_id:job1,scenario:'A funding liquidity crunch'});
    expect(r.status).toBe(200);expect(r.data.result.model).toBe('google/gemini-2.5-flash-lite');
    expect(r.data.result.analysis.headline).toBe('Gateway explanation');
    expect(f.fetcher.mock.calls.some(c=>String(c[0]).includes('generativelanguage'))).toBe(false);
  });
  it('cannot replay a request ID into another paid provider run',async()=>{
    const f=fixture();const payload={action:'run',job_id:job1,scenario:'A funding liquidity crunch'};
    expect((await f.call(payload)).status).toBe(200);f.fetcher.mockClear();
    const replay=await f.call(payload);expect(replay.data.replayed).toBe(true);expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('keeps Nasdaq numerical results when Gemini is rate-limited, without inventing AI analysis',async()=>{
    const f=fixture();const original=f.fetcher.getMockImplementation();
    f.fetcher.mockImplementation(async(input:string|URL,init:RequestInit)=>{
      if(String(input).includes('generativelanguage'))return new Response('',{status:429});
      if(original)return original(input,init);
      return new Response('',{status:503});
    });
    const response=await f.call({action:'run',job_id:job1,scenario:'A funding liquidity crunch'});
    expect(response.status).toBe(200);expect(response.data.result.market.asset).toBe('NASDAQ Composite');
    expect(response.data.result.analysis).toBeNull();expect(response.data.result.model).toBe('none');
    expect(response.data.result.warnings.join(' ')).toContain('keyword rules');
  });
});
