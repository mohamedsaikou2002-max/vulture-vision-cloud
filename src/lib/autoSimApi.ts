import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { withRequestDeadline } from './requestDeadline';
import type { Dim, Agent, DimDistribution, StrategyAgg } from "../../supabase/functions/_shared/autosim_engine";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); this.name = "ApiError"; }
}

import type { AutoSimResult } from '../../supabase/functions/_shared/autosim_types';
export type { AutoSimResult, Analysis, HistoricalRow, HeadlineRef } from '../../supabase/functions/_shared/autosim_types';
import { validateAutoSimResult, validateWorldState, object } from '../../supabase/functions/_shared/autosim_contract';
import type { buildWorldPulse } from '../../supabase/functions/_shared/world_pulse';
export interface JobRow { id: string; scenario: string; status: string; created_at: string; parent_job_id: string | null; error?: string | null }

const Envelope = z.object({ ok: z.boolean(), error: z.object({ code: z.string(), message: z.string() }).optional() }).passthrough();

const FRIENDLY: Record<string, string> = {
  subscription_required: "An active subscription is required to run simulations.",
  quota_exceeded: "You've reached today's simulation limit.",
  unauthorized: "Your session expired. Sign in again.",
  gemini_not_configured: "The AI key isn't configured on the server yet.",
};
const wasAborted = (value: unknown) => value !== null && typeof value === 'object' && 'name' in value && /timeout|abort/i.test(String(value.name));

export async function callAutoSim<T = Record<string, unknown>>(payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
 try {return await withRequestDeadline(async deadline => {
  const { data: { session } } = await supabase.auth.getSession();
  deadline.throwIfAborted();
  if (!session) throw new ApiError("unauthorized", FRIENDLY.unauthorized, 401);
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vv-autosim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(payload),
      signal: deadline,
    });
  } catch (e) { throw new ApiError(wasAborted(e) ? "timeout" : "network", "The response could not be confirmed. Check the pending run before starting another.", 0); }
  if (res.status === 401) throw new ApiError('unauthorized', FRIENDLY.unauthorized, 401);
  if (res.status === 403) throw new ApiError('forbidden', 'This account does not have access to the requested workspace feature.', 403);
  if (res.status === 404) throw new ApiError('not_deployed', 'The simulation service has not been deployed to this workspace yet.', 404);
  const text = await res.text();
  if (!text) throw new ApiError("empty_response", "The simulation service returned nothing. Try again.", res.status);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new ApiError("invalid_json", "The simulation service returned an unreadable response.", res.status); }
  if(!res.ok && parsed && typeof parsed==='object' && typeof (parsed as {error?:unknown}).error==='string'){
    const code=({402:'subscription_required',429:'quota_exceeded',502:'upstream_unavailable',503:'service_unavailable',504:'timeout'} as Record<number,string>)[res.status]||'request_failed';
    throw new ApiError(code,String((parsed as {error:string}).error),res.status);
  }
  const env = Envelope.safeParse(parsed);
  if (!env.success) throw new ApiError("invalid_response", "Unexpected response from the simulation service.", res.status);
  if (!res.ok || !env.data.ok) {
    const e = env.data.error;
    throw new ApiError(e?.code ?? "error", FRIENDLY[e?.code ?? ""] ?? e?.message ?? "The simulation failed.", res.status);
  }
  return parsed as T;
 },payload.action === 'world_state' ? 30000 : 120000,signal);
 }catch(e){
  if(e instanceof ApiError)throw e;
  throw new ApiError(wasAborted(e) ? 'timeout' : 'network','The response could not be confirmed. Check the pending run before starting another.',0);
 }
}

export const parseResult = (value: unknown): AutoSimResult => validateAutoSimResult(value) as unknown as AutoSimResult;
export async function runSimulation(p: { scenario: string; job_id: string; constraints?: {horizon_days?:number;risk_profile?:"conservative"|"balanced"|"aggressive"}; parent_job_id?: string; article_ids?: string[]; inject?: { dimension: string; delta: number } }, signal?: AbortSignal) {
  const r = await callAutoSim<{ ok: true; job_id: string; result: unknown }>({ action: 'run', ...p }, signal);
  if (r.job_id !== p.job_id) throw new ApiError('invalid_response', 'The returned result belongs to a different request.', 502);
  return { ...r, result: parseResult(r.result) };
}
export const interrogateAgent = (job_id: string, agent: string, question: string) =>
  callAutoSim<{ ok: true; answer: string }>({ action: "interrogate", job_id, agent, question });
export interface WorldStateResult {
  ok: true; as_of: string; baseline: Record<Dim, number>; detail: AutoSimResult['state']['detail']; neutral_dimensions: Dim[];
  data_status: { id: string; ok: boolean; detail: string }[];
  observations?: Record<string,{value:number;source:string;observed_at:string}>;
  world_pulse?: ReturnType<typeof buildWorldPulse>;
}
export async function fetchWorldState(): Promise<WorldStateResult> {
  const value = await callAutoSim({ action: 'world_state' });
  const validated=validateWorldState(value);
  const age=Date.now()-Date.parse(String(validated.as_of));
  if(age>300000||age < -60000)throw new ApiError("stale_world_state","World state is stale. Refresh the snapshot.",503);
  return validated as unknown as WorldStateResult;
}

const jobs = () => supabase.from('autosim_jobs');
export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await jobs().select("id,scenario,status,created_at,parent_job_id,error").order("created_at", { ascending: false }).limit(30).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new ApiError("history_unavailable", "Couldn't load your history.", 500);
  return data as JobRow[];
}
export async function loadJob(id: string): Promise<AutoSimResult | null> {
  const { data, error } = await jobs().select("result").eq("id", id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if (error) throw new ApiError("history_unavailable", "Couldn't open this simulation.", 500);
  return data?.result ? parseResult(data.result) : null;
}
export async function jobStatus(id: string): Promise<string | null> {
  const { data, error } = await jobs().select("status").eq("id", id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if (error) throw new ApiError("history_unavailable", "Couldn't read this simulation's status.", 500);
  return data?.status ?? null;
}
