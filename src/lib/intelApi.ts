// Authenticated Supabase proxy for subscriber-only intelligence backends.
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────

export interface RegimeState {
  current_state: "risk_on" | "risk_off" | "neutral" | "volatile" | "trending";
  current_duration_sessions: number;
  transition_probs_next_session: Record<string, number>;
  transition_probs_n_sessions: Record<string, number>;
  n_sessions: number;
  most_likely_next: string;
  regime_summary: string;
  stationary_distribution: Record<string, number>;
  observations_count: number;
}

export interface SupportingSignal {
  signal: string;
  source: string;
  url: string;
  ticker_impact: string[];
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  journalist_exclusive: boolean;
}

export interface TickerImplication {
  ticker: string;
  direction: "bullish" | "bearish" | "neutral";
  reasoning: string;
  time_horizon: string;
  confidence: number;
}

export interface AlphaAlert {
  alert: string;
  source_journalist?: string;
  why_it_matters: string;
  urgency: "high" | "medium" | "low";
}

export interface IntelBrief {
  brief_id: string;
  generated_at: string;
  cycle_type: "scheduled" | "urgent_journalist";
  thesis: string;
  thesis_confidence: number;
  regime_assessment: {
    current_regime: string;
    regime_summary: string;
    transition_watch: string;
  };
  supporting_signals: SupportingSignal[];
  contradicting_signals: Array<{
    signal: string;
    source: string;
    url: string;
    confidence: number;
  }>;
  ticker_implications: TickerImplication[];
  regional_breakdown: Record<string, string>;
  alpha_alerts: AlphaAlert[];
  morning_brief_headline: string;
  overall_confidence: number;
  _meta?: {
    articles_processed: number;
    cycle_type: string;
    regime_at_synthesis: string;
    avg_sentiment: number;
    markov_prediction: RegimeState;
  };
}

// ── Subscriber-only backend calls ─────────────────────────
async function requestIntel<T>(operation: string): Promise<T|null> {
  try {
    const {data,error}=await supabase.functions.invoke("vv-research-proxy",{body:{operation}});
    if(error||data?.error) return null;
    return data as T;
  } catch{return null;}
}
export function fetchLatestBrief(): Promise<IntelBrief|null> {
  return requestIntel<IntelBrief>("intel-brief");
}
export function fetchRegime(): Promise<RegimeState|null> {
  return requestIntel<RegimeState>("intel-regime");
}
export function fetchHealth(): Promise<{status:string;queue_depth:number}|null> {
  return requestIntel<{status:string;queue_depth:number}>("intel-health");
}
export function triggerSynthesis(): Promise<{message:string}|null> {
  return requestIntel<{message:string}>("intel-synthesize");
}
/** Live sockets from a public client would bypass Stripe. Existing screens poll
 * for research updates; realtime requires an authenticated Supabase channel. */
export function subscribeToIntelBriefs(
  _onBrief: (brief: IntelBrief)=>void, _onRegime?: (regime:RegimeState)=>void
): ()=>void {
  return ()=>{};
}

// ── Helpers ─────────────────────────────────────────────────

export const REGIME_COLORS: Record<string, string> = {
  risk_on:  "var(--green)",
  risk_off: "var(--red)",
  neutral:  "var(--gold)",
  volatile: "var(--cyan)",
  trending: "var(--blue-accent)",
};

export const REGIME_LABELS: Record<string, string> = {
  risk_on:  "RISK-ON",
  risk_off: "RISK-OFF",
  neutral:  "NEUTRAL",
  volatile: "VOLATILE",
  trending: "TRENDING",
};

export function dirClass(direction: string): "up" | "down" | "dim" {
  if (direction === "bullish") return "up";
  if (direction === "bearish") return "down";
  return "dim";
}

export function dirArrow(direction: string): string {
  if (direction === "bullish") return "↑";
  if (direction === "bearish") return "↓";
  return "→";
}

export function confidenceLabel(n: number): string {
  if (n >= 80) return "HIGH";
  if (n >= 60) return "MED";
  return "LOW";
}

export function timeAgoShort(iso?: string): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
