import { DIMENSIONS, riskOffScore, type DimVector } from './autosim_engine.ts';
export interface PulseHeadline { title: string; source: string; url: string; published_at: string | null; first_seen: string }
/** Belicia PodRoom-inspired presentation, backed by explicit economic inputs instead of an ungrounded AI "live" prompt. */
export function buildWorldPulse(baseline: DimVector, neutral: string[], headlines: PulseHeadline[], asOf = new Date().toISOString()) {
  const observed = DIMENSIONS.length - neutral.length;
  const usable = headlines.filter(h => /^https?:\/\//.test(h.url)).slice(0,3);
  const risk = observed ? riskOffScore(baseline) : null;
  return {
    kind: 'derived_market_snapshot' as const, as_of: asOf,
    status: observed ? (neutral.length ? 'partial' : 'available') : 'unavailable',
    shock_level: risk, world_mood: risk === null ? 'unavailable' : risk > .6 ? 'negative' : risk < .4 ? 'positive' : 'neutral',
    market_risk_appetite: risk === null ? null : 1 - risk,
    top_shocks: usable,
    note: 'Shock and mood are illustrative market indicators, not measured public psychology or verified geopolitical events. Headlines are related reporting, not instructions.',
    observed_dimensions: observed,
  };
}
