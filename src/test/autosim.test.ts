import { describe, expect, it } from "vitest";
import {
  DIMENSIONS, STRATEGY_IDS, autoConfigure, backtest, buildBaseline, buyAndHold, dailyLogVol, marketConditions,
  neutralVector, riskOffScore, runDimensionScenario, scenarioMonteCarlo, EVENT_SHOCKS, type CostModel,
} from "../../supabase/functions/_shared/autosim_engine";

const cost: CostModel = { fee_bps: 10, slippage_bps: 3, spread_bps: 2, leverage: 1, funding_bps_per_day: 1 };
const trend = (n: number, step: number, start = 100) => Array.from({ length: n }, (_, i) => start * Math.exp(step * i));

describe("dimension engine", () => {
  const base = neutralVector();
  const run = (seed: number, shocks = EVENT_SHOCKS.crypto_exchange_failure) => runDimensionScenario({ baseline: base, shocks, horizonDays: 30, paths: 200, seed });
  it("is deterministic for a seed and differs across seeds", () => {
    expect(run(7).distribution.fear.p50).toBe(run(7).distribution.fear.p50);
    expect(run(7).distribution.fear.p50).not.toBe(run(8).distribution.fear.p50);
  });
  it("keeps every dimension inside [0,1] with ordered percentiles", () => {
    const r = run(1);
    for (const d of DIMENSIONS) {
      const x = r.distribution[d];
      expect(x.p5).toBeGreaterThanOrEqual(0); expect(x.p95).toBeLessThanOrEqual(1);
      expect(x.p5).toBeLessThanOrEqual(x.p50); expect(x.p50).toBeLessThanOrEqual(x.p95);
    }
  });
  it("an exchange-failure shock raises fear and lowers trust vs baseline", () => {
    const r = run(3);
    expect(r.distribution.fear.p50).toBeGreaterThan(0.5);
    expect(r.distribution.trust.p50).toBeLessThan(0.5);
  });
  it("stress builds through feedback, peaks, then recovers instead of saturating", () => {
    const f = run(4).trajectory.fear;
    const peak = Math.max(...f);
    expect(peak).toBeGreaterThan(f[0]);
    expect(peak).toBeLessThan(0.95);
    expect(f[30]).toBeLessThan(peak);
  });
  it("a positive-growth shock lowers the risk-off score", () => {
    const r = run(5, EVENT_SHOCKS.positive_growth_surprise);
    expect(riskOffScore(Object.fromEntries(DIMENSIONS.map(d => [d, r.distribution[d].p50])) as never)).toBeLessThan(riskOffScore(base));
  });
});

describe("baseline from observables", () => {
  it("labels dimensions without data as neutral defaults and never fabricates a source", () => {
    const b = buildBaseline({ vix: { value: 30, source: "FRED:VIXCLS", observed_at: "2026-10-16" } }, Date.parse("2026-10-19"));
    expect(b.detail.fear.source).toBe("FRED:VIXCLS");
    expect(b.detail.fear.stale_days).toBe(3);
    expect(b.baseline.fear).toBeCloseTo((30 - 12) / 28, 5);
    expect(b.neutral).toContain("trust");
    expect(b.detail.trust.source).toBe("neutral_default");
  });
});

describe("strategies and costs", () => {
  it("trend following profits on a clean uptrend and shorts a downtrend", () => {
    expect(backtest(trend(200, 0.01), 60, "trend_following", cost).total_return).toBeGreaterThan(0.5);
    expect(backtest(trend(200, -0.01), 60, "trend_following", cost).total_return).toBeGreaterThan(0);
  });
  it("higher fees and slippage reduce returns", () => {
    const closes = Array.from({ length: 220 }, (_, i) => 100 * Math.exp(0.002 * i + 0.05 * Math.sin(i / 3)));
    const cheap = backtest(closes, 60, "mean_reversion", cost).total_return;
    const dear = backtest(closes, 60, "mean_reversion", { ...cost, fee_bps: 60, slippage_bps: 40 }).total_return;
    expect(dear).toBeLessThan(cheap);
  });
  it("leverage can liquidate on a crash", () => {
    const closes = [...trend(100, 0.005), ...Array.from({ length: 12 }, (_, i) => 100 * Math.exp(0.5) * Math.pow(0.8, i + 1))];
    const m = backtest(closes, 60, "trend_following", { ...cost, leverage: 5 });
    expect(m.liquidated).toBe(true); expect(m.total_return).toBeLessThanOrEqual(-0.9);
  });
  it("buy and hold matches the price move", () => {
    expect(buyAndHold([100, 110, 121], 0).total_return).toBeCloseTo(0.21, 6);
  });
  it("auto-config lowers leverage under stress, respects the profile cap, and widens slippage with volatility", () => {
    const calm = neutralVector(); const stressed = { ...calm, fear: 0.9, volatility: 0.9, default_risk: 0.9, liquidity: 0.1, trust: 0.2 };
    const a = autoConfigure(calm, calm, "aggressive"), b = autoConfigure(calm, stressed, "aggressive");
    expect(b.cost.leverage).toBeLessThan(a.cost.leverage);
    expect(a.cost.leverage).toBeLessThanOrEqual(5);
    expect(autoConfigure(calm, { ...calm, fear: 0.1, volatility: 0.1 }, "conservative").cost.leverage).toBeLessThanOrEqual(2);
    expect(b.cost.slippage_bps).toBeGreaterThan(a.cost.slippage_bps);
  });
});

describe("scenario Monte Carlo", () => {
  const warm = trend(120, 0.001);
  const mkMc = (shock = EVENT_SHOCKS.liquidity_crunch) => {
    const base = neutralVector();
    const res = runDimensionScenario({ baseline: base, shocks: shock, horizonDays: 30, paths: 100, seed: 2 });
    return marketConditions(base, res, dailyLogVol(warm) + 0.02, 30);
  };
  it("returns all six strategies, reproducibly, with probabilities in range", () => {
    const o = { warmupCloses: warm, mc: mkMc(), horizon: 30, paths: 40, seed: 11, cost, bias: -1 };
    const a = scenarioMonteCarlo(o), b = scenarioMonteCarlo(o);
    expect(a.strategies.map(s => s.id)).toEqual([...STRATEGY_IDS]);
    expect(a.strategies[0].median_return).toBe(b.strategies[0].median_return);
    for (const s of a.strategies) { expect(s.prob_loss).toBeGreaterThanOrEqual(0); expect(s.prob_liquidation).toBeLessThanOrEqual(1); expect(s.p5_return).toBeLessThanOrEqual(s.p95_return); }
  });
  it("a risk-off scenario has lower buy-and-hold median than a risk-on one", () => {
    const off = scenarioMonteCarlo({ warmupCloses: warm, mc: mkMc(EVENT_SHOCKS.liquidity_crunch), horizon: 30, paths: 120, seed: 5, cost, bias: -1 });
    const on = scenarioMonteCarlo({ warmupCloses: warm, mc: mkMc(EVENT_SHOCKS.positive_growth_surprise), horizon: 30, paths: 120, seed: 5, cost, bias: 1 });
    expect(off.buy_hold.median_return).toBeLessThan(on.buy_hold.median_return);
  });
});
