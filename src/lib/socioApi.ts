// Subscriber-only Supabase relay. Never contact a visitor's localhost or a public backend directly.
import { supabase } from "@/integrations/supabase/client";

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

export type SocioErrorKind = "offline" | "http" | "malformed" | "timeout";
export interface SocioResult {
  data: SocioFull | null;
  error?: { kind: SocioErrorKind; message: string; status?: number };
}

export async function fetchSocioFull(): Promise<SocioResult> {
  try {
    const {data,error}=await supabase.functions.invoke("vv-research-proxy",{body:{operation:"socio-full"}});
    if(error||data?.error)return {data:null,error:{kind:"offline",message:"Protected socio-economic service unavailable"}};
    if(data?.status!=="ok" || !data.data || typeof data.data!=="object")
      return {data:null,error:{kind:"malformed",message:"Invalid socio-economic service response"}};
    return {data:data.data as SocioFull};
  }catch{return {data:null,error:{kind:"offline",message:"Socio-economic backend unavailable"}};}
}
export async function fetchSocioHealth(): Promise<boolean> {
  try {
    const {data,error}=await supabase.functions.invoke("vv-research-proxy",{body:{operation:"socio-health"}});
    return !error && !data?.error && data?.status==="ok";
  }catch{return false;}
}
export function socioBaseUrl(){return "Authenticated Supabase research gateway";}

export function colorForDim(dim: string, val: number): string {
  const badHigh = ["fear", "volatility", "inflation", "default"];
  const goodHigh = ["trust", "liquidity", "credit", "consumer", "employment", "growth"];
  if (badHigh.includes(dim)) return val > 0.65 ? "#ff2222" : val > 0.5 ? "#ff9d4d" : "#00ff88";
  if (goodHigh.includes(dim)) return val < 0.35 ? "#ff2222" : val < 0.5 ? "#ff9d4d" : "#00ff88";
  return "#f0c040";
}
