import { AGENTS, DIMENSIONS, EVENT_TYPES, STRATEGY_IDS } from './autosim_engine.ts';
export interface Analysis { headline?: string; summary?: string; drivers?: string[]; risks?: string[]; gaps?: string[]; what_would_change_this?: string[]; spoken_summary?: string }
export function parseAnalysis(value: unknown): Analysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const out: Analysis = {};
  for (const key of ['headline', 'summary', 'spoken_summary'] as const) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 2000)) return null;
    if (typeof body[key] === 'string') out[key] = body[key];
  }
  for (const key of ['drivers', 'risks', 'gaps', 'what_would_change_this'] as const) {
    const values = body[key];
    if (values !== undefined && (!Array.isArray(values) || values.length > 12 || values.some(v => typeof v !== 'string' || v.length > 1000))) return null;
    if (Array.isArray(values)) out[key] = values as string[];
  }
  return Object.keys(out).length ? out : null;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid simulation response');
  return value as Record<string, unknown>;
}
export const finite = (v: unknown, min = -Infinity, max = Infinity): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const strings = (v: unknown) => Array.isArray(v) && v.every(s => typeof s === 'string');
export function validateWorldState(value: unknown) {
  const w = object(value), baseline = object(w.baseline), detail = object(w.detail);
  if (typeof w.as_of !== 'string' || !Number.isFinite(Date.parse(w.as_of)) || !strings(w.neutral_dimensions) || !Array.isArray(w.data_status)) throw new Error('Invalid world state');
  if ((w.neutral_dimensions as string[]).some(d=>!(DIMENSIONS as readonly string[]).includes(d)) || new Set(w.neutral_dimensions as string[]).size !== (w.neutral_dimensions as string[]).length) throw new Error('Invalid neutral dimensions');
  for (const d of DIMENSIONS) {
    const row = object(detail[d]);
    if (!finite(baseline[d], 0, 1) || !finite(row.value, 0, 1) || typeof row.source !== 'string') throw new Error('Invalid world state dimension');
  }
  if (w.data_status.some(s => { const r = object(s); return typeof r.id !== 'string' || typeof r.ok !== 'boolean' || typeof r.detail !== 'string'; })) throw new Error('Invalid source status');
  if(w.observations !== undefined){
    for(const raw of Object.values(object(w.observations))){const observation=object(raw);if(!finite(observation.value)||typeof observation.source!=="string"||typeof observation.observed_at!=="string"||!Number.isFinite(Date.parse(observation.observed_at)))throw new Error("Invalid market observation");}
  }
  if(w.world_pulse !== undefined){
    const pulse=object(w.world_pulse);
    if(pulse.kind!=='derived_market_snapshot'||!['partial','available','unavailable'].includes(String(pulse.status))||!['positive','negative','neutral','unavailable'].includes(String(pulse.world_mood))||(pulse.shock_level!==null&&!finite(pulse.shock_level,0,1))||(pulse.market_risk_appetite!==null&&!finite(pulse.market_risk_appetite,0,1))||typeof pulse.note!=='string'||!Array.isArray(pulse.top_shocks))throw new Error('Invalid world pulse');
    for(const raw of pulse.top_shocks){const h=object(raw);if(typeof h.title!=='string'||typeof h.source!=='string'||typeof h.url!=='string'||!/^https?:\/\//.test(h.url)||(h.published_at!==null&&(typeof h.published_at!=='string'||!Number.isFinite(Date.parse(h.published_at)))))throw new Error('Invalid pulse headline');}
  }
  return w;
}
/** Validate fields used by every tab before rendering or replaying a stored job. */
export function validateAutoSimResult(value: unknown) {
  const r = object(value), state = object(r.state), dimensions = object(r.dimensions), distribution = object(dimensions.distribution), trajectory = object(dimensions.trajectory);
  if (!finite(r.horizon_days, 1, 30) || !Number.isInteger(r.horizon_days) || !finite(r.seed, 0, 4294967295) || !Number.isInteger(r.seed) || typeof r.engine_version !== 'string' || typeof r.model !== 'string' || typeof r.scenario !== 'string' || !strings(r.warnings) || typeof r.disclaimer !== 'string' || typeof r.calibration_status !== 'string' || !['hypothetical','evidence_grounded_counterfactual'].includes(String(r.mode))) throw new Error('Invalid simulation result');
  validateWorldState({ ...state, as_of: r.as_of });
  const agents = object(r.agents);
  for (const a of AGENTS) if (!finite(agents[a], -1, 1)) throw new Error('Invalid simulated agent');
  for (const d of DIMENSIONS) {
    const x = object(distribution[d]), path = trajectory[d];
    if (!['baseline','mean','p5','p50','p95'].every(k => finite(x[k],0,1)) || Number(x.p5) > Number(x.p50) || Number(x.p50) > Number(x.p95) || !Array.isArray(path) || path.length !== Number(r.horizon_days) + 1 || path.some(v => !finite(v,0,1))) throw new Error('Invalid dimension distribution');
  }
  const interp = object(r.interpretation);
  if (typeof interp.summary !== 'string' || !(EVENT_TYPES as readonly unknown[]).includes(interp.event_type) || typeof interp.asset !== 'string' || typeof interp.is_hypothetical !== 'boolean' || !strings(interp.regions) || !strings(interp.sectors) || !finite(interp.confidence,0,1) || !['conservative','balanced','aggressive'].includes(String(interp.risk_profile)) || Object.values(object(interp.shock_rationale)).some(v => typeof v !== 'string')) throw new Error('Invalid interpretation');
  const evidence = object(r.evidence);
  if (!['found','none_found','unavailable'].includes(String(evidence.status)) || !finite(evidence.window_hours,1,168) || !finite(evidence.sources_reporting,0) || !finite(evidence.independent_sources,0) || !finite(evidence.matched,0) || !Array.isArray(evidence.selected)) throw new Error('Invalid evidence');
  for (const v of evidence.selected) {
    const h = object(v);
    if (!['title','source','country','url','first_seen'].every(k => typeof h[k] === 'string') || !/^https?:\/\//i.test(String(h.url)) || (h.published_at !== null && (typeof h.published_at !== 'string' || !Number.isFinite(Date.parse(h.published_at))))) throw new Error('Invalid headline');
  }
  const execution = object(r.execution), cost = object(execution.cost);
  if (!strings(execution.rationale) || !['fee_bps','slippage_bps','spread_bps','funding_bps_per_day'].every(k=>finite(cost[k],0,1000)) || !finite(cost.leverage,1,5)) throw new Error('Invalid execution settings');
  const strategies = object(r.strategies), hold = object(strategies.buy_hold_scenario);
  if (!['median_return','p5_return','p95_return'].every(k=>finite(hold[k],-1)) || !Array.isArray(strategies.scenario) || strategies.scenario.length !== 6) throw new Error('Invalid strategy results');
  for (const raw of strategies.scenario) {
    const s = object(raw);
    if (!(STRATEGY_IDS as readonly unknown[]).includes(s.id) || typeof s.label !== 'string' || !['median_return','p5_return','p95_return'].every(k=>finite(s[k],-1)) || !['prob_loss','prob_liquidation','median_max_drawdown'].every(k=>finite(s[k],0,1)) || !finite(s.median_trades,0)) throw new Error('Invalid strategy metrics');
  }
  if (strategies.historical !== null) {
    const h = object(strategies.historical), w = object(h.window), bh = object(h.buy_hold);
    if (typeof w.start !== 'string' || typeof w.end !== 'string' || !finite(w.days,1) || typeof h.note !== 'string' || !finite(bh.total_return,-1) || !finite(bh.max_drawdown,0,1) || !Array.isArray(h.strategies)) throw new Error('Invalid historical replay');
    for (const raw of h.strategies) { const s=object(raw); if(typeof s.id!=='string'||typeof s.available!=='boolean'||(s.available&&!finite(s.total_return,-1))) throw new Error('Invalid historical strategy'); }
  }
  const market = object(r.market);
  if(market.asset !== 'NASDAQ Composite' || object(r.interpretation).asset !== 'NASDAQ Composite')throw new Error('This result is not a Nasdaq simulation. Start a new Nasdaq baseline.');
  if (typeof market.asset!=='string'||typeof market.price_source!=='string'||!finite(market.base_daily_vol,0)||!finite(market.risk_off_shift)||!finite(market.direction_bias,-1,1)) throw new Error('Invalid market model');
  for (const raw of [object(r.shocks).applied, object(r.shocks).injected]) if(Object.entries(object(raw)).some(([k,v])=>!(DIMENSIONS as readonly string[]).includes(k)||!finite(v,-.25,.25)))throw new Error('Invalid shocks');
  if (r.replay_spec !== undefined) {
    const replay=object(r.replay_spec), candles=object(replay.candles);
    if (!finite(replay.dim_paths,1,600)||!Number.isInteger(replay.dim_paths)||!finite(replay.strategy_paths,1,200)||!Number.isInteger(replay.strategy_paths)||!Array.isArray(candles.closes)||candles.closes.length>366||candles.closes.some(v=>!finite(v,Number.MIN_VALUE))||!strings(candles.dates)||(candles.dates as string[]).length!==candles.closes.length) throw new Error('Invalid replay inputs');
    const status=object(candles.status); if(typeof status.id!=='string'||typeof status.ok!=='boolean'||typeof status.detail!=='string')throw new Error('Invalid replay source');
  }
  return { ...r, analysis: parseAnalysis(r.analysis) };
}
