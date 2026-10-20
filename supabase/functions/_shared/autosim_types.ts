import type { Dim, Agent, DimDistribution, StrategyAgg, EventType, RiskProfile } from './autosim_engine.ts';
import type { Analysis } from './autosim_contract.ts';
export type { Analysis } from './autosim_contract.ts';
export interface HeadlineRef { title: string; source: string; url: string; country: string; published_at: string | null; first_seen: string }
export interface HistoricalRow { id: string; label: string; available: boolean; reason?: string; total_return?: number; max_drawdown?: number; sharpe?: number; trades?: number; win_rate?: number | null; liquidated?: boolean }
export interface AutoSimResult {
  engine_version: string; model: string; as_of: string; scenario: string; seed: number; horizon_days: number;
  mode: "evidence_grounded_counterfactual" | "hypothetical";
  interpretation: { event_type: EventType; summary: string; is_hypothetical: boolean; asset: string; regions: string[]; sectors: string[]; shock_rationale: Record<string, string>; risk_profile: RiskProfile; confidence: number };
  evidence: { status: "found" | "none_found" | "unavailable"; window_hours: number; sources_reporting: number; matched: number; independent_sources: number; selected: HeadlineRef[] };
  state: { baseline: Record<Dim, number>; detail: Record<Dim, { value: number; source: string; observed_at?: string; stale_days?: number | null }>; neutral_dimensions: Dim[]; data_status: { id: string; ok: boolean; detail: string }[] };
  shocks: { applied: Partial<Record<Dim, number>>; injected: Partial<Record<Dim, number>>; gemini?: Partial<Record<Dim, number>>; prior?: Partial<Record<Dim, number>> };
  dimensions: { distribution: Record<Dim, DimDistribution>; trajectory: Record<Dim, number[]> };
  agents: Record<Agent, number>;
  market: { asset: string; price_source: string; base_daily_vol: number; risk_off_shift: number; direction_bias: number };
  execution: { cost: { fee_bps: number; slippage_bps: number; spread_bps: number; leverage: number; funding_bps_per_day: number }; rationale: string[] };
  strategies: {
    scenario: StrategyAgg[]; buy_hold_scenario: { median_return: number; p5_return: number; p95_return: number };
    historical: null | { window: { start: string; end: string; days: number }; note: string; buy_hold: { total_return: number; max_drawdown: number }; strategies: HistoricalRow[] };
  };
  replay_spec?: { candles: { closes: number[]; dates: string[]; status: { id: string; ok: boolean; detail: string } }; dim_paths: number; strategy_paths: number };
  analysis: Analysis | null; warnings: string[]; calibration_status: string; disclaimer: string;
}
