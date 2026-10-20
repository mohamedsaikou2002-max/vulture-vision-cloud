import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Dim, Agent, DimDistribution, StrategyAgg } from "../../supabase/functions/_shared/autosim_engine";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); this.name = "ApiError"; }
}

export interface HeadlineRef { title: string; source: string; url: string; country: string; published_at: string | null; first_seen: string }
export interface HistoricalRow { id: string; label: string; available: boolean; reason?: string; total_return?: number; max_drawdown?: number; sharpe?: number; trades?: number; win_rate?: number | null; liquidated?: boolean }
export interface Analysis { headline?: string; summary?: string; drivers?: string[]; risks?: string[]; gaps?: string[]; what_would_change_this?: string[]; spoken_summary?: string }
export interface AutoSimResult {
  engine_version: string; model: string; as_of: string; scenario: string; seed: number; horizon_days: number;
  mode: "evidence_grounded_counterfactual" | "hypothetical";
  interpretation: { event_type: string; summary: string; is_hypothetical: boolean; asset: string; regions: string[]; sectors: string[]; shock_rationale: Record<string, string>; risk_profile: string; confidence: number };
  evidence: { status: "found" | "none_found" | "unavailable"; window_hours: number; sources_reporting: number; matched: number; independent_sources: number; selected: HeadlineRef[] };
  state: { baseline: Record<Dim, number>; detail: Record<Dim, { value: number; source: string; observed_at?: string; stale_days?: number | null }>; neutral_dimensions: Dim[]; data_status: { id: string; ok: boolean; detail: string }[] };
  shocks: { applied: Partial<Record<Dim, number>>; injected: Partial<Record<Dim, number>> };
  dimensions: { distribution: Record<Dim, DimDistribution>; trajectory: Record<Dim, number[]> };
  agents: Record<Agent, number>;
  market: { asset: string; price_source: string; base_daily_vol: number; risk_off_shift: number; direction_bias: number };
  execution: { cost: { fee_bps: number; slippage_bps: number; spread_bps: number; leverage: number; funding_bps_per_day: number }; rationale: string[] };
  strategies: {
    scenario: StrategyAgg[]; buy_hold_scenario: { median_return: number; p5_return: number; p95_return: number };
    historical: null | { window: { start: string; end: string; days: number }; note: string; buy_hold: { total_return: number; max_drawdown: number }; strategies: HistoricalRow[] };
  };
  analysis: Analysis | null; warnings: string[]; calibration_status: string; disclaimer: string;
}
export interface JobRow { id: string; scenario: string; status: string; created_at: string; parent_job_id: string | null; error?: string | null }

const Envelope = z.object({ ok: z.boolean(), error: z.object({ code: z.string(), message: z.string() }).optional() }).passthrough();

const FRIENDLY: Record<string, string> = {
  subscription_required: "An active subscription is required to run simulations.",
  quota_exceeded: "You've reached today's simulation limit.",
  unauthorized: "Your session expired. Sign in again.",
  gemini_not_configured: "The AI key isn't configured on the server yet.",
};

export async function callAutoSim<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError("unauthorized", FRIENDLY.unauthorized, 401);
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vv-autosim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(payload),
    });
  } catch { throw new ApiError("network", "Can't reach the simulation service. Check your connection.", 0); }
  const text = await res.text();
  if (!text) throw new ApiError("empty_response", "The simulation service returned nothing. Try again.", res.status);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new ApiError("invalid_json", "The simulation service returned an unreadable response.", res.status); }
  const env = Envelope.safeParse(parsed);
  if (!env.success) throw new ApiError("invalid_response", "Unexpected response from the simulation service.", res.status);
  if (!res.ok || !env.data.ok) {
    const e = env.data.error;
    throw new ApiError(e?.code ?? "error", FRIENDLY[e?.code ?? ""] ?? e?.message ?? "The simulation failed.", res.status);
  }
  return parsed as T;
}

export const runSimulation = (p: { scenario: string; job_id: string; parent_job_id?: string; inject?: { dimension: string; delta: number } }) =>
  callAutoSim<{ ok: true; job_id: string; result: AutoSimResult }>({ action: "run", ...p });
export const interrogateAgent = (job_id: string, agent: string, question: string) =>
  callAutoSim<{ ok: true; answer: string }>({ action: "interrogate", job_id, agent, question });
export const fetchWorldState = () =>
  callAutoSim<{ ok: true; as_of: string; baseline: Record<Dim, number>; detail: AutoSimResult["state"]["detail"]; neutral_dimensions: Dim[]; data_status: { id: string; ok: boolean; detail: string }[] }>({ action: "world_state" });

// The jobs table is created by migration 20261019090000 and isn't in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jobs = () => (supabase as unknown as { from: (t: string) => any }).from("autosim_jobs");
export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await jobs().select("id,scenario,status,created_at,parent_job_id,error").order("created_at", { ascending: false }).limit(30);
  if (error) throw new ApiError("history_unavailable", "Couldn't load your history.", 500);
  return data as JobRow[];
}
export async function loadJob(id: string): Promise<AutoSimResult | null> {
  const { data, error } = await jobs().select("result").eq("id", id).maybeSingle();
  if (error) throw new ApiError("history_unavailable", "Couldn't open this simulation.", 500);
  return (data?.result as AutoSimResult) ?? null;
}
export async function jobStatus(id: string): Promise<string | null> {
  const { data, error } = await jobs().select("status").eq("id", id).maybeSingle();
  if (error) throw new ApiError("history_unavailable", "Couldn't read this simulation's status.", 500);
  return data?.status ?? null;
}
