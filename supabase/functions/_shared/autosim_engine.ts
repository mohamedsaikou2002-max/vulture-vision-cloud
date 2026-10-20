// Vulture Vision — AutoSim numerical engine (pure TypeScript, no imports, runs in Deno and Vite).
// Everything here is deterministic given a seed. Coefficients are ILLUSTRATIVE and UNCALIBRATED;
// outputs are scenario-conditional stress tests, never forecasts or investment advice.

export const DIMENSIONS = [
  "fear", "trust", "liquidity", "volatility", "credit",
  "consumer_activity", "inflation", "employment", "growth", "default_risk",
] as const;
export type Dim = typeof DIMENSIONS[number];
export type DimVector = Record<Dim, number>;
export type Shock = Partial<Record<Dim, number>>;

export const EVENT_TYPES = [
  "banking_cyberattack", "rate_hike", "energy_supply_shock", "demand_slowdown",
  "trade_restriction", "crypto_exchange_failure", "geopolitical_conflict",
  "liquidity_crunch", "regulatory_crackdown", "positive_growth_surprise", "generic",
] as const;
export type EventType = typeof EVENT_TYPES[number];

// Priors ported from socioeconomic.py (first five) plus extensions. Gemini may override per scenario.
export const EVENT_SHOCKS: Record<EventType, Shock> = {
  banking_cyberattack: { fear: .08, trust: -.07, liquidity: -.05, volatility: .07, credit: -.05, consumer_activity: -.03, employment: -.02, growth: -.03, default_risk: .07 },
  rate_hike: { fear: .025, liquidity: -.06, volatility: .025, credit: -.06, consumer_activity: -.025, inflation: -.025, growth: -.03, default_risk: .025 },
  energy_supply_shock: { fear: .04, trust: -.015, volatility: .045, credit: -.015, consumer_activity: -.025, inflation: .08, employment: -.015, growth: -.035, default_risk: .035 },
  demand_slowdown: { fear: .04, trust: -.025, liquidity: -.02, volatility: .03, credit: -.025, consumer_activity: -.07, employment: -.04, growth: -.07, default_risk: .05 },
  trade_restriction: { fear: .035, trust: -.02, liquidity: -.02, volatility: .04, credit: -.015, inflation: .03, growth: -.035, default_risk: .02 },
  crypto_exchange_failure: { fear: .09, trust: -.09, liquidity: -.08, volatility: .09, credit: -.03, default_risk: .04 },
  geopolitical_conflict: { fear: .07, trust: -.03, liquidity: -.03, volatility: .06, inflation: .03, growth: -.025, default_risk: .03 },
  liquidity_crunch: { fear: .06, trust: -.04, liquidity: -.1, volatility: .06, credit: -.07, growth: -.03, default_risk: .06 },
  regulatory_crackdown: { fear: .04, trust: -.03, liquidity: -.03, volatility: .04, credit: -.01 },
  positive_growth_surprise: { fear: -.04, trust: .03, liquidity: .03, volatility: -.03, credit: .03, consumer_activity: .03, employment: .02, growth: .04, default_risk: -.03 },
  generic: { fear: .02, trust: -.01, volatility: .02, growth: -.01, default_risk: .015 },
};

export const INTERACTIONS: Record<Dim, Partial<Record<Dim, number>>> = {
  fear: { trust: -.025, volatility: .025, default_risk: .02 },
  trust: { fear: -.03, growth: .012, default_risk: -.02 },
  liquidity: { trust: .018, fear: -.018, default_risk: -.018 },
  volatility: { fear: .025, trust: -.014, default_risk: .018 },
  credit: { liquidity: .025, volatility: -.018, default_risk: -.02 },
  consumer_activity: { trust: .018, credit: .02, inflation: -.016, fear: -.016 },
  inflation: { consumer_activity: .01, growth: .006 },
  employment: { growth: .022, consumer_activity: .012, fear: -.014 },
  growth: { consumer_activity: .02, credit: .015, employment: .01 },
  default_risk: { fear: .02, volatility: .018, liquidity: -.018, growth: -.018 },
};

export const AGENTS = ["banks", "investors", "consumers", "businesses", "governments", "central_banks", "labor"] as const;
export type Agent = typeof AGENTS[number];

export const AGENT_RESPONSES: Record<Agent, Partial<Record<Dim, number>>> = {
  banks: { liquidity: .3, credit: .25, default_risk: -.3, fear: -.15 },
  investors: { fear: -.3, trust: .2, volatility: -.25, growth: .15 },
  consumers: { trust: .25, fear: -.25, inflation: -.2, employment: .2 },
  businesses: { credit: .2, consumer_activity: .25, fear: -.15, growth: .2 },
  governments: { employment: .2, default_risk: -.15, trust: .1 },
  central_banks: { inflation: -.3, liquidity: .25, volatility: -.1 },
  labor: { employment: .3, consumer_activity: .1, fear: -.15 },
};
const AGENT_IMPACTS: Record<Agent, Partial<Record<Dim, number>>> = {
  banks: { credit: .004, liquidity: .004, default_risk: -.004 },
  investors: { trust: .002, volatility: -.004, growth: .002 },
  consumers: { consumer_activity: .004, employment: .002 },
  businesses: { employment: .003, growth: .003 },
  governments: { trust: .002, employment: .002 },
  central_banks: { inflation: -.003, liquidity: .003 },
  labor: { employment: .003, consumer_activity: .001 },
};
export const ENGINE_ASSUMPTIONS = {
  path_noise_sigma: 0.008,
  shock_decay_per_day: 0.72,
  mean_reversion_per_day: 0.08, // added vs the original Python engine, whose feedback loops saturate at 1.0
  coefficients: "Illustrative and uncalibrated. Agent responses are bounded heuristics, not observed behavior.",
  deviations_measured_from: "the estimated starting state (not a fixed 0.5)",
};
export const ENGINE_VERSION = "autosim-1.0.0";

// ── helpers ──────────────────────────────────────────────────
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussian(rng: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function percentile(values: number[], p: number) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.min(lo + 1, s.length - 1);
  return s[lo] * (1 - (pos - lo)) + s[hi] * (pos - lo);
}
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); };

export function neutralVector(): DimVector {
  return Object.fromEntries(DIMENSIONS.map(d => [d, 0.5])) as DimVector;
}

// ── 1. dimension scenario (10-dimension socioeconomic engine) ─
export interface DimScenarioInput {
  baseline: DimVector; shocks: Shock; horizonDays: number; paths: number; seed: number;
}
export interface DimDistribution { baseline: number; mean: number; p5: number; p50: number; p95: number }
export interface DimScenarioResult {
  distribution: Record<Dim, DimDistribution>;
  trajectory: Record<Dim, number[]>; // mean path, index 0 = day 0 (after shock)
  agent_response_mean: Record<Agent, number>;
  initial_state: DimVector;
}

export function runDimensionScenario(inp: DimScenarioInput): DimScenarioResult {
  const { baseline, shocks, horizonDays, paths, seed } = inp;
  const rng = mulberry32(seed);
  const decay = ENGINE_ASSUMPTIONS.shock_decay_per_day;
  const sigma = ENGINE_ASSUMPTIONS.path_noise_sigma;
  const kRev = ENGINE_ASSUMPTIONS.mean_reversion_per_day;
  const init = { ...baseline } as DimVector;
  for (const d of DIMENSIONS) init[d] = clamp(baseline[d] + (shocks[d] ?? 0));
  const ends = Object.fromEntries(DIMENSIONS.map(d => [d, [] as number[]])) as Record<Dim, number[]>;
  const sums = Object.fromEntries(DIMENSIONS.map(d => [d, new Array(horizonDays + 1).fill(0)])) as Record<Dim, number[]>;
  const agentEnd = Object.fromEntries(AGENTS.map(a => [a, [] as number[]])) as Record<Agent, number[]>;
  for (const d of DIMENSIONS) sums[d][0] = init[d] * paths;

  for (let p = 0; p < paths; p++) {
    let state = { ...init } as DimVector;
    const agentScore = Object.fromEntries(AGENTS.map(a => [a, 0])) as Record<Agent, number>;
    for (let day = 1; day <= horizonDays; day++) {
      const dev = {} as DimVector;
      for (const d of DIMENSIONS) dev[d] = state[d] - baseline[d];
      for (const a of AGENTS) {
        let r = 0;
        for (const [dim, w] of Object.entries(AGENT_RESPONSES[a])) r += (w as number) * dev[dim as Dim];
        agentScore[a] = Math.min(0.5, Math.max(-0.5, r));
      }
      const next = {} as DimVector;
      for (const t of DIMENSIONS) {
        let inter = 0;
        for (const [src, c] of Object.entries(INTERACTIONS[t])) inter += (c as number) * dev[src as Dim];
        let agentEffect = 0;
        for (const a of AGENTS) agentEffect += (AGENT_IMPACTS[a][t] ?? 0) * agentScore[a];
        const decayed = (shocks[t] ?? 0) * Math.pow(decay, day);
        next[t] = clamp(state[t] + inter + agentEffect + decayed - kRev * dev[t] + gaussian(rng) * sigma);
      }
      state = next;
      for (const d of DIMENSIONS) sums[d][day] += state[d];
    }
    for (const d of DIMENSIONS) ends[d].push(state[d]);
    for (const a of AGENTS) agentEnd[a].push(agentScore[a]);
  }
  const distribution = {} as Record<Dim, DimDistribution>;
  const trajectory = {} as Record<Dim, number[]>;
  for (const d of DIMENSIONS) {
    distribution[d] = { baseline: baseline[d], mean: mean(ends[d]), p5: percentile(ends[d], .05), p50: percentile(ends[d], .5), p95: percentile(ends[d], .95) };
    trajectory[d] = sums[d].map(s => s / paths);
  }
  const agent_response_mean = Object.fromEntries(AGENTS.map(a => [a, mean(agentEnd[a])])) as Record<Agent, number>;
  return { distribution, trajectory, agent_response_mean, initial_state: init };
}

// ── 2. observable → baseline state ───────────────────────────
export interface Observable { value: number; observed_at?: string; source: string }
export type Observables = Partial<Record<string, Observable>>;
export interface BaselineDim { value: number; source: string; observed_at?: string; stale_days?: number | null }

const norm = (v: number, lo: number, hi: number, invert = false) => {
  const x = clamp((v - lo) / (hi - lo));
  return invert ? 1 - x : x;
};
export function buildBaseline(obs: Observables, now = Date.now()): { baseline: DimVector; detail: Record<Dim, BaselineDim>; neutral: Dim[] } {
  const spec: Record<Dim, () => { v: number; o?: Observable } | null> = {
    fear: () => obs.vix ? { v: norm(obs.vix.value, 12, 40), o: obs.vix } : obs.crypto_vol_ann ? { v: norm(obs.crypto_vol_ann.value, .3, 1.2), o: obs.crypto_vol_ann } : null,
    volatility: () => obs.crypto_vol_ann ? { v: norm(obs.crypto_vol_ann.value, .3, 1.2), o: obs.crypto_vol_ann } : obs.vix ? { v: norm(obs.vix.value, 12, 40), o: obs.vix } : null,
    credit: () => obs.hy_spread ? { v: norm(obs.hy_spread.value, 3, 10, true), o: obs.hy_spread } : null,
    default_risk: () => obs.hy_spread ? { v: norm(obs.hy_spread.value, 3, 10), o: obs.hy_spread } : null,
    inflation: () => obs.cpi_yoy ? { v: norm(obs.cpi_yoy.value, 0, .08), o: obs.cpi_yoy } : null,
    employment: () => obs.unrate ? { v: norm(obs.unrate.value, 3, 8, true), o: obs.unrate } : null,
    growth: () => obs.curve_10y2y ? { v: norm(obs.curve_10y2y.value, -1.5, 2.5), o: obs.curve_10y2y } : null,
    liquidity: () => obs.nfci ? { v: norm(obs.nfci.value, -.8, .8, true), o: obs.nfci } : null,
    trust: () => obs.umcsent ? { v: norm(obs.umcsent.value, 50, 110), o: obs.umcsent } : null,
    consumer_activity: () => obs.retail_yoy ? { v: norm(obs.retail_yoy.value, -.02, .1), o: obs.retail_yoy } : null,
  };
  const baseline = neutralVector();
  const detail = {} as Record<Dim, BaselineDim>;
  const neutral: Dim[] = [];
  for (const d of DIMENSIONS) {
    const r = spec[d]();
    if (r?.o && Number.isFinite(r.v)) {
      baseline[d] = r.v;
      const t = r.o?.observed_at ? Date.parse(r.o.observed_at) : NaN;
      detail[d] = { value: r.v, source: r.o.source, observed_at: r.o?.observed_at, stale_days: Number.isFinite(t) ? Math.round((now - t) / 86400000) : null };
    } else {
      detail[d] = { value: 0.5, source: "neutral_default", stale_days: null };
      neutral.push(d);
    }
  }
  return { baseline, detail, neutral };
}

// ── 3. dimension state → market conditions ────────────────────
export function riskOffScore(v: DimVector) {
  return (v.fear + v.volatility + v.default_risk + (1 - v.liquidity) + (1 - v.trust) + (1 - v.growth)) / 6;
}
export interface MarketConditions { dailyVolPath: number[]; dailyDriftPath: number[]; riskOffShift: number; jumpProb: number[] }
export function marketConditions(baseline: DimVector, res: DimScenarioResult, baseDailyVol: number, horizon: number): MarketConditions {
  const rb = riskOffScore(baseline);
  const dailyVolPath: number[] = [], dailyDriftPath: number[] = [], jumpProb: number[] = [];
  let shift = 0;
  for (let t = 0; t <= horizon; t++) {
    const v = {} as DimVector;
    for (const d of DIMENSIONS) v[d] = res.trajectory[d][t];
    const s = riskOffScore(v) - rb;
    if (t === Math.min(2, horizon)) shift = s;
    dailyVolPath.push(clamp(baseDailyVol * (1 + 4 * (v.volatility - baseline.volatility)), baseDailyVol * 0.5, baseDailyVol * 3));
    dailyDriftPath.push(clamp(-0.05 * s, -0.012, 0.012));
    jumpProb.push(clamp(0.015 + 0.25 * Math.max(0, v.fear - baseline.fear), 0, 0.2));
  }
  return { dailyVolPath, dailyDriftPath, riskOffShift: shift, jumpProb };
}

// ── 4. six strategies ─────────────────────────────────────────
export const STRATEGY_IDS = ["trend_following", "mean_reversion", "breakout", "vol_targeted_trend", "event_driven", "defensive_derisk"] as const;
export type StrategyId = typeof STRATEGY_IDS[number];
export const STRATEGY_INFO: Record<StrategyId, { label: string; blurb: string; needsScenario: boolean }> = {
  trend_following: { label: "Trend following", blurb: "Long when the 20-day average is above the 50-day, short when below.", needsScenario: false },
  mean_reversion: { label: "Mean reversion", blurb: "Fades moves more than 1.5 standard deviations from the 20-day average.", needsScenario: false },
  breakout: { label: "Breakout", blurb: "Enters when price breaks its 20-day high or low and holds until the opposite break.", needsScenario: false },
  vol_targeted_trend: { label: "Volatility-targeted trend", blurb: "Trend direction with position size scaled to hold daily volatility near target.", needsScenario: false },
  event_driven: { label: "Event-driven", blurb: "Takes the direction your scenario implies and exits on a volatility-scaled stop.", needsScenario: true },
  defensive_derisk: { label: "Defensive de-risk", blurb: "Stays long but cuts exposure as realized volatility rises.", needsScenario: false },
};
interface Ctx { closes: number[]; t: number; prev: number; bias: number; entryIdx: number; entryPrice: number }
const sma = (c: number[], t: number, n: number) => mean(c.slice(Math.max(0, t - n + 1), t + 1));
function ema(c: number[], t: number, n: number) {
  const k = 2 / (n + 1); let e = c[Math.max(0, t - 3 * n)];
  for (let i = Math.max(0, t - 3 * n) + 1; i <= t; i++) e = c[i] * k + e * (1 - k);
  return e;
}
function realizedVol(c: number[], t: number, n: number) {
  const r: number[] = [];
  for (let i = Math.max(1, t - n + 1); i <= t; i++) r.push(Math.log(c[i] / c[i - 1]));
  return r.length > 2 ? std(r) : 0.03;
}
export function strategySignal(id: StrategyId, x: Ctx): number {
  const { closes: c, t, prev } = x;
  if (t < 50) return 0;
  switch (id) {
    case "trend_following": return ema(c, t, 20) > ema(c, t, 50) ? 1 : -1;
    case "mean_reversion": {
      const w = c.slice(t - 19, t + 1), m = mean(w), s = std(w) || 1e-9, z = (c[t] - m) / s;
      if (z < -1.5) return 1; if (z > 1.5) return -1;
      if (Math.abs(z) < 0.3) return 0; return prev;
    }
    case "breakout": {
      const w = c.slice(t - 20, t);
      if (c[t] > Math.max(...w)) return 1; if (c[t] < Math.min(...w)) return -1; return prev;
    }
    case "vol_targeted_trend": {
      const dir = ema(c, t, 20) > ema(c, t, 50) ? 1 : -1;
      return dir * clamp(0.02 / Math.max(realizedVol(c, t, 14), 1e-6), 0, 1);
    }
    case "event_driven": {
      if (x.bias === 0) return 0;
      if (x.entryIdx >= 0 && prev !== 0) {
        const pnl = (c[t] / x.entryPrice - 1) * Math.sign(prev);
        if (pnl < -2 * realizedVol(c, t, 14) * Math.sqrt(5)) return 0; // stopped out
        return prev;
      }
      return x.entryIdx >= 0 ? 0 : x.bias; // one entry only
    }
    case "defensive_derisk": {
      const rv = realizedVol(c, t, 14), rvLong = realizedVol(c, t, 50) || rv;
      return clamp(1 - Math.max(0, rv / (2 * rvLong) - 0.25), 0, 1);
    }
  }
}

export interface CostModel { fee_bps: number; slippage_bps: number; spread_bps: number; leverage: number; funding_bps_per_day: number }
export interface BacktestMetrics {
  total_return: number; max_drawdown: number; sharpe: number; trades: number;
  win_rate: number | null; liquidated: boolean; avg_exposure: number;
}
export function backtest(closes: number[], startIdx: number, id: StrategyId, cost: CostModel, bias = 0): BacktestMetrics {
  let equity = 1, peak = 1, maxDD = 0, pos = 0, liquidated = false;
  let entryIdx = -1, entryPrice = 0, tradeEq = 1, wins = 0, trades = 0, expo = 0;
  const rets: number[] = [];
  const perUnit = (cost.fee_bps + cost.slippage_bps + cost.spread_bps / 2) / 1e4;
  for (let t = startIdx; t < closes.length - 1; t++) {
    const target = clamp(strategySignal(id, { closes, t, prev: pos, bias, entryIdx, entryPrice }), -1, 1);
    const turnover = Math.abs(target - pos);
    if (turnover > 1e-9) {
      equity *= 1 - turnover * cost.leverage * perUnit;
      if (pos === 0 || Math.sign(target) !== Math.sign(pos)) {
        if (pos !== 0) { trades++; if (equity > tradeEq) wins++; }
        tradeEq = equity;
        if (target !== 0) { entryIdx = t; entryPrice = closes[t]; }
      } else if (target === 0 && pos !== 0) { trades++; if (equity > tradeEq) wins++; }
    }
    pos = target;
    const r = closes[t + 1] / closes[t] - 1;
    const pnl = pos * cost.leverage * r - Math.abs(pos) * cost.leverage * cost.funding_bps_per_day / 1e4;
    const before = equity;
    equity *= 1 + pnl;
    expo += Math.abs(pos) * cost.leverage;
    if (equity <= 0.05 * before || 1 + pnl <= 0.02) { equity = 0; liquidated = true; rets.push(-1); break; }
    rets.push(equity / before - 1);
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, 1 - equity / peak);
  }
  if (pos !== 0 && !liquidated) { trades++; if (equity > tradeEq) wins++; }
  const sd = std(rets);
  return {
    total_return: equity - 1, max_drawdown: liquidated ? 1 : maxDD,
    sharpe: sd > 1e-9 ? (mean(rets) / sd) * Math.sqrt(365) : 0, trades,
    win_rate: trades ? wins / trades : null, liquidated, avg_exposure: rets.length ? expo / rets.length : 0,
  };
}
export function buyAndHold(closes: number[], startIdx: number) {
  let peak = closes[startIdx], dd = 0;
  for (let t = startIdx; t < closes.length; t++) { peak = Math.max(peak, closes[t]); dd = Math.max(dd, 1 - closes[t] / peak); }
  return { total_return: closes[closes.length - 1] / closes[startIdx] - 1, max_drawdown: dd };
}

// ── 5. automatic execution settings (no user input) ───────────
export type RiskProfile = "conservative" | "balanced" | "aggressive";
export function autoConfigure(baseline: DimVector, endState: DimVector, risk: RiskProfile): { cost: CostModel; rationale: string[] } {
  const stress = riskOffScore(endState);
  const cap = { conservative: 2, balanced: 3, aggressive: 5 }[risk];
  const byStress = stress > 0.62 ? 1 : stress > 0.55 ? 2 : stress > 0.48 ? 3 : 4;
  const leverage = Math.max(1, Math.min(cap, byStress));
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  const fee = Number(denoEnv?.get("VV_DEFAULT_FEE_BPS") ?? 10) || 10;
  const slip = Number((2 + 20 * Math.max(0, endState.volatility - 0.4) + 15 * Math.max(0, 0.5 - endState.liquidity)).toFixed(1));
  const spread = Number((2 + 12 * Math.max(0, 0.5 - endState.liquidity)).toFixed(1));
  const funding = 1;
  return {
    cost: { fee_bps: fee, slippage_bps: slip, spread_bps: spread, leverage, funding_bps_per_day: funding },
    rationale: [
      `Risk-off score at horizon ${stress.toFixed(2)} → leverage ${leverage}× (profile cap ${cap}×).`,
      `Slippage ${slip} bps and spread ${spread} bps widen as simulated volatility rises and liquidity falls.`,
      `Taker fee ${fee} bps and funding ${funding} bps/day are defaults — set VV_DEFAULT_FEE_BPS to match your venue.`,
    ],
  };
}

// ── 6. scenario Monte Carlo over price paths ──────────────────
export interface StrategyAgg {
  id: StrategyId; label: string;
  median_return: number; p5_return: number; p95_return: number;
  prob_loss: number; prob_liquidation: number; median_max_drawdown: number; median_trades: number;
}
export function scenarioMonteCarlo(opts: {
  warmupCloses: number[]; mc: MarketConditions; horizon: number; paths: number; seed: number; cost: CostModel; bias: number;
}): { strategies: StrategyAgg[]; buy_hold: { median_return: number; p5_return: number; p95_return: number } } {
  const { warmupCloses, mc, horizon, paths, seed, cost, bias } = opts;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const base = warmupCloses.slice(-60);
  const res = Object.fromEntries(STRATEGY_IDS.map(s => [s, [] as BacktestMetrics[]])) as Record<StrategyId, BacktestMetrics[]>;
  const bh: number[] = [];
  for (let p = 0; p < paths; p++) {
    const c = [...base];
    for (let t = 1; t <= horizon; t++) {
      const vol = mc.dailyVolPath[t], drift = mc.dailyDriftPath[t];
      let r = drift + vol * gaussian(rng);
      if (rng() < mc.jumpProb[t]) r -= Math.abs(gaussian(rng)) * vol * 3 * (mc.riskOffShift >= 0 ? 1 : -1); // risk-off → down-jumps, risk-on → up-jumps
      c.push(c[c.length - 1] * Math.exp(clamp(r, -0.5, 0.5)));
    }
    const start = base.length - 1;
    for (const s of STRATEGY_IDS) res[s].push(backtest(c, start, s, cost, bias));
    bh.push(c[c.length - 1] / c[start] - 1);
  }
  const strategies = STRATEGY_IDS.map(id => {
    const m = res[id], tr = m.map(x => x.total_return);
    return {
      id, label: STRATEGY_INFO[id].label,
      median_return: percentile(tr, .5), p5_return: percentile(tr, .05), p95_return: percentile(tr, .95),
      prob_loss: mean(tr.map(x => (x < 0 ? 1 : 0))), prob_liquidation: mean(m.map(x => (x.liquidated ? 1 : 0))),
      median_max_drawdown: percentile(m.map(x => x.max_drawdown), .5), median_trades: percentile(m.map(x => x.trades), .5),
    };
  });
  return { strategies, buy_hold: { median_return: percentile(bh, .5), p5_return: percentile(bh, .05), p95_return: percentile(bh, .95) } };
}

export function dailyLogVol(closes: number[], n = 30) {
  const r: number[] = [];
  for (let i = Math.max(1, closes.length - n); i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1]));
  return std(r) || 0.03;
}
