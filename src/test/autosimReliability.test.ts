import { describe,it,expect,vi,afterEach } from 'vitest';
import { buildBaseline,backtest,DIMENSIONS,neutralVector } from '../../supabase/functions/_shared/autosim_engine';
import { NASDAQ_MARKET,loadNasdaqCandles,validCandles,nasdaqObservations } from '../../supabase/functions/_shared/autosim_data';
import { validateAutoSimResult,parseAnalysis,validateWorldState } from '../../supabase/functions/_shared/autosim_contract';
import { buildWorldPulse } from '../../supabase/functions/_shared/world_pulse';
import { parseAutoSimRequest } from '../../supabase/functions/_shared/autosim_request';
import { simulationFixture } from './fixtures/autosim';

describe('World-state provenance and freshness',()=>{
  it('uses series-specific freshness windows and defaults stale/missing observations',()=>{
    const now=Date.parse('2026-10-19T12:00:00Z');
    const b=buildBaseline({vix:{value:40,observed_at:'2000-01-01',source:'old'},cpi_yoy:{value:.04,observed_at:'2026-09-01',source:'monthly'},unrate:{value:4,source:'undated'}},now);
    expect(b.neutral).toContain('fear');expect(b.detail.fear.source).toBe('neutral_default');expect(b.baseline.fear).toBe(.5);
    expect(b.neutral).not.toContain('inflation');expect(b.neutral).toContain('employment');
  });
  it('never presents a default-only Belicia-style pulse as a measured mood',()=>{
    const pulse=buildWorldPulse(neutralVector(),[...DIMENSIONS],[]);
    expect(pulse.status).toBe('unavailable');expect(pulse.shock_level).toBeNull();expect(pulse.world_mood).toBe('unavailable');
    expect(pulse.note).toContain('not measured public psychology');
  });
  it('retains headline source/link/date and labels partial market observations',()=>{
    const headline={title:'Liquidity update',source:'Publisher',url:'https://example.com/story',published_at:'2026-10-19T00:00:00Z',first_seen:'2026-10-19T00:10:00Z'};
    const pulse=buildWorldPulse(neutralVector(),['trust'],[headline]);expect(pulse.status).toBe('partial');expect(pulse.top_shocks).toEqual([headline]);
  });
  it('accepts only complete, fresh, finite and unique daily candles, skipping weekend/holiday placeholders',()=>{
    const day=Math.floor(Date.now()/86400000)*86400;
    const payload=(ts:number[],closes:(number|null)[])=>({chart:{result:[{timestamp:ts,indicators:{quote:[{close:closes}]}}]}});
    const ts=Array.from({length:100},(_,i)=>day-(100-i)*86400);
    const closes=ts.map((_,i)=>100+i);
    expect(validCandles(payload(ts,closes)).closes).toHaveLength(100);
    expect(validCandles(payload(ts,closes.map((c,i)=>i===50?null:c))).closes).toHaveLength(99);
    const dupTs=[...ts];dupTs.splice(50,0,ts[50]);
    expect(()=>validCandles(payload(dupTs,[...closes,closes[50]]))).toThrow('Duplicate');
    expect(()=>validCandles(payload(ts.map(t=>t-365*86400),closes))).toThrow('stale');
    expect(()=>validCandles(payload(ts,closes.map((c,i)=>i===5?NaN:c)))).toThrow('Invalid');
  });
  it('simulates the Nasdaq Composite index, never a crypto asset',()=>{
    expect(NASDAQ_MARKET.symbol).toBe('^IXIC');
    expect(NASDAQ_MARKET.label).toMatch(/nasdaq/i);
    expect(NASDAQ_MARKET.label).not.toMatch(/crypto|bitcoin|btc|coinbase/i);
  });
  it('loads Nasdaq daily candles from Yahoo and reports failures without throwing',async()=>{
    const day=Math.floor(Date.now()/86400000)*86400;
    const ts=Array.from({length:120},(_,i)=>day-(120-i)*86400);
    const payload={chart:{result:[{timestamp:ts,indicators:{quote:[{close:ts.map((_,i)=>20000+i)}]}}]}};
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>payload})));
    const okRes=await loadNasdaqCandles();
    expect(okRes.status.ok).toBe(true);expect(okRes.status.id).toBe('yahoo:NASDAQ');expect(okRes.closes).toHaveLength(120);expect(okRes.closes[0]).toBeGreaterThan(1000);
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:503,json:async()=>({})})));
    const failRes=await loadNasdaqCandles();
    expect(failRes.status.ok).toBe(false);expect(failRes.status.id).toBe('yahoo:NASDAQ');expect(failRes.closes).toHaveLength(0);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('offline');}));
    expect((await loadNasdaqCandles()).status.ok).toBe(false);
  });
  afterEach(()=>vi.unstubAllGlobals());
});
describe('Safe numerical results and headline handoff',()=>{
  it('normalizes malformed optional AI explanations while keeping valid numerical results',()=>{
    const fixture=simulationFixture();
    expect(validateAutoSimResult({...fixture,analysis:{drivers:'unexpected scalar'}}).analysis).toBeNull();
    expect(parseAnalysis({drivers:['A'],summary:'A summary'})).toEqual({drivers:['A'],summary:'A summary'});
    expect(()=>validateAutoSimResult({...fixture,dimensions:{distribution:{},trajectory:{}}})).toThrow();
    expect(()=>validateAutoSimResult({...fixture,seed:Infinity})).toThrow();
  });
  it('keeps every strategy finite with a flat synthetic warm-up',()=>{
    const result=simulationFixture();
    expect(result.strategies.scenario.every(s=>Number.isFinite(s.median_return)&&Number.isFinite(s.median_max_drawdown))).toBe(true);
  });
  it('rejects malformed world-state arrays before rendering',()=>{
    const fixture=simulationFixture();
    expect(()=>validateWorldState({...fixture.state,as_of:fixture.as_of,neutral_dimensions:['bogus']})).toThrow();
  });
  it('charges both sides of a completed flat-price trade',()=>{
    const metrics=backtest(Array(65).fill(100),60,'event_driven',{fee_bps:100,slippage_bps:0,spread_bps:0,leverage:1,funding_bps_per_day:0},1);
    expect(metrics.total_return).toBeCloseTo(-.0199,8);expect(metrics.max_drawdown).toBeCloseTo(.0199,8);expect(metrics.sharpe).toBeLessThan(0);
  });
  it('bounds selected article IDs in server requests',()=>{
    const request={scenario:'A bank experiences funding stress',job_id:'00000000-0000-4000-8000-000000000001',article_ids:['a'.repeat(64)]};
    expect(parseAutoSimRequest(request).article_ids).toEqual(request.article_ids);
    expect(()=>parseAutoSimRequest({...request,article_ids:['arbitrary-reference']})).toThrow();
  });
});

it('rejects legacy results that would replay a different market under a Nasdaq label',()=>{
 const result=simulationFixture();result.market.asset='BTC-USD';
 expect(()=>validateAutoSimResult(result)).toThrow('not a Nasdaq simulation');
});

it('exposes Nasdaq close and observed returns with their actual trading date',()=>{
 const closes=Array.from({length:21},(_,i)=>100+i);
 const result=nasdaqObservations({closes,dates:Array(21).fill('2026-10-19')});
 expect(result.nasdaq_close).toMatchObject({value:120,observed_at:'2026-10-19'});
 expect(result.nasdaq_daily_return.value).toBeCloseTo(120/119-1);
 expect(result.nasdaq_20_session_return.value).toBeCloseTo(.2);
 expect(result.nasdaq_close.source).toContain('^IXIC');
 expect(nasdaqObservations({closes:[],dates:[]})).toEqual({});
});
