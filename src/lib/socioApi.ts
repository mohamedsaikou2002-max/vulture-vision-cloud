// Vulture Vision — Socio-Economics Backend API Client
// Connects to socioeconomics_backend.py on VITE_SOCIO_HOST (default localhost:5002)

const SOCIO_HOST = (import.meta.env.VITE_SOCIO_HOST as string) || "localhost:5002";
const isHttps = typeof location !== "undefined" && location.protocol === "https:";
const BASE_URL = `${isHttps ? "https" : "http"}://${SOCIO_HOST}`;

export const SOCIO_DIMS = [
  "fear", "trust", "liquidity", "volatility",
  "credit", "consumer", "inflation", "employment", "growth", "default",
] as const;
export type SocioDim = typeof SOCIO_DIMS[number];

export interface AgentRow {
  type: string;
  belief_fear: number;
  trust: number;
  risk_appetite: number;
  stance: "BUY" | "SELL" | "HOLD" | "DE-RISK" | string;
}

export interface EventRow {
  event_type: string;
  severity: number;
  confidence: number;
  consensus: number;
  sources: string[];
  headline: string;
}

export interface BlendRow { scenario: string; weight: number }

export interface MonteCarlo {
  n_paths?: number;
  n_days?: number;
  probabilities?: { crash?: number; recession?: number; recovery?: number; boom?: number };
}

export interface SocioFull {
  signals: Record<string, number>;
  confidence: Record<string, number> & { overall?: number };
  graph_updates: { version: number; prior_version: number };
  simulation?: { scenario_blend?: BlendRow[]; monte_carlo?: MonteCarlo };
  agents?: AgentRow[];
  events_recent?: EventRow[];
  explanations?: Record<string, string[]>;
  narrative?: string;
  telemetry?: Record<string, number | string> & { llm_error?: string };
  metadata?: { timestamp?: string; lookback_hours?: number; sources?: string[] };
}

export async function fetchSocioFull(): Promise<SocioFull | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/socioeconomics/full`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "ok") return null;
    return json.data as SocioFull;
  } catch { return null; }
}

export async function fetchSocioHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/api/socioeconomics/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const d = await r.json();
    return d.status === "ok";
  } catch { return false; }
}

export function colorForDim(dim: string, val: number): string {
  const badHigh = ["fear", "volatility", "inflation", "default"];
  const goodHigh = ["trust", "liquidity", "credit", "consumer", "employment", "growth"];
  if (badHigh.includes(dim)) return val > 0.65 ? "#ff2222" : val > 0.5 ? "#ff9d4d" : "#00ff88";
  if (goodHigh.includes(dim)) return val < 0.35 ? "#ff2222" : val < 0.5 ? "#ff9d4d" : "#00ff88";
  return "#f0c040";
}
