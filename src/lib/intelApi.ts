// Vulture Vision — Intelligence Backend API Client
// Connects to vv_intel_backend running on VITE_INTEL_HOST:8000

const INTEL_HOST = (import.meta.env.VITE_INTEL_HOST as string) || "localhost:8000";
const isHttps = typeof location !== "undefined" && location.protocol === "https:";
const BASE_URL = `${isHttps ? "https" : "http"}://${INTEL_HOST}`;
const WS_URL = `${isHttps ? "wss" : "ws"}://${INTEL_HOST}`;

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

// ── REST calls ──────────────────────────────────────────────

export async function fetchLatestBrief(): Promise<IntelBrief | null> {
  try {
    const res = await fetch(`${BASE_URL}/brief/latest`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchRegime(): Promise<RegimeState | null> {
  try {
    const res = await fetch(`${BASE_URL}/regime`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchHealth(): Promise<{ status: string; queue_depth: number } | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function triggerSynthesis(): Promise<{ message: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/synthesize/now`, { method: "POST", signal: AbortSignal.timeout(90000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── WebSocket subscription ──────────────────────────────────

export function subscribeToIntelBriefs(
  onBrief: (brief: IntelBrief) => void,
  onRegime?: (regime: RegimeState) => void,
): () => void {
  let ws: WebSocket | null = null;
  let dead = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    if (dead) return;
    try {
      ws = new WebSocket(`${WS_URL}/ws`);
    } catch {
      retryTimer = setTimeout(connect, 5000);
      return;
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "synthesis_brief" && msg.data) {
          onBrief(msg.data);
          try { window.dispatchEvent(new CustomEvent("vv-new-intel")); } catch {}
        }
        if (msg.type === "regime_update" && msg.data && onRegime) onRegime(msg.data);
      } catch {}
    };
    ws.onerror = () => { try { ws?.close(); } catch {} };
    ws.onclose = () => {
      if (!dead) retryTimer = setTimeout(connect, 5000);
    };
  }

  connect();
  return () => {
    dead = true;
    if (retryTimer) clearTimeout(retryTimer);
    try { ws?.close(); } catch {}
  };
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
