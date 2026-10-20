// Vulture Vision — Socio-Economics Backend API Client
// Connects to socioeconomics_backend.py on VITE_SOCIO_HOST (default localhost:5002)

import { observedSocio, currentWorld } from './workspaceData';
import { backendOrigin } from './backendOrigin';
const BASE_URL = backendOrigin(import.meta.env.VITE_SOCIO_HOST, false, 5002, typeof location !== 'undefined' && location.protocol === 'https:');

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
  observations?:Record<string,{value:number;source:string;observed_at:string}>;
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

export type SocioErrorKind = "configuration" | "offline" | "http" | "malformed" | "timeout";
export interface SocioResult {
  data: SocioFull | null;
  error?: { kind: SocioErrorKind; message: string; status?: number };
}

export async function fetchSocioFull(): Promise<SocioResult> {
  if (!BASE_URL) { try { return {data:await observedSocio()}; } catch { return {data:null,error:{kind:"offline",message:"Live economic observations are unavailable. Refresh after the world-state service is connected."}}; } }
  try {
    const res = await fetch(`${BASE_URL}/api/socioeconomics/full`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      return { data: null, error: { kind: "http", status: res.status, message: `HTTP ${res.status} ${res.statusText}` } };
    }
    let json: {status?:string;data?:SocioFull};
    try {
      json = await res.json();
    } catch (e: unknown) {
      return { data: null, error: { kind: "malformed", message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` } };
    }
    if (!json || typeof json !== "object") {
      return { data: null, error: { kind: "malformed", message: "Response was not a JSON object" } };
    }
    if (json.status !== "ok" || !json.data || typeof json.data !== "object") {
      return { data: null, error: { kind: "malformed", message: `Unexpected payload shape (status="${json.status}")` } };
    }
    return { data: json.data as SocioFull };
  } catch (e: unknown) {
    const msg = String(e instanceof Error ? e.message : String(e));
    const kind: SocioErrorKind = /timeout|abort/i.test(msg) ? "timeout" : "offline";
    return { data: null, error: { kind, message: msg || "Network error" } };
  }
}

export async function fetchSocioHealth(): Promise<boolean> {
  if (!BASE_URL) { try { await currentWorld();return true; } catch {return false;} }
  try {
    const r = await fetch(`${BASE_URL}/api/socioeconomics/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const d = await r.json();
    return d.status === "ok";
  } catch { return false; }
}

export function socioBaseUrl() { return BASE_URL; }

export function colorForDim(dim: string, val: number): string {
  const badHigh = ["fear", "volatility", "inflation", "default"];
  const goodHigh = ["trust", "liquidity", "credit", "consumer", "employment", "growth"];
  if (badHigh.includes(dim)) return val > 0.65 ? "#ff2222" : val > 0.5 ? "#ff9d4d" : "#00ff88";
  if (goodHigh.includes(dim)) return val < 0.35 ? "#ff2222" : val < 0.5 ? "#ff9d4d" : "#00ff88";
  return "#f0c040";
}
