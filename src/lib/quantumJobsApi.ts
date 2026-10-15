import { supabase } from "@/integrations/supabase/client";

export interface QuantumJob {
  id: string;
  status: string;
  n_qubits: number;
  shots: number;
  est_qpu_secs: number;
  quote_cents: number;
  approved_cap_cents: number | null;
  provider_job_id: string | null;
  provider_reported_qpu_secs: number | null;
  charge_cents: number | null;
  refund_cents: number;
  currency: string;
  payment_status: string;
  settlement_status: string;
  error: string | null;
  created_at: string;
  quote_expires_at: string | null;
}

export interface QuantumJobsResponse {
  config: {
    stripe_configured: boolean;
    ibm_configured: boolean;
    currency: string;
    max_qubits: number;
    markup_bp: number;
  };
  jobs: QuantumJob[];
  events: { id: string; job_id: string; event: string; data: Record<string, unknown>; created_at: string }[];
  period_totals: { jobs: number; charged_cents: number; refunded_cents: number; qpu_secs: number; pending: number };
}

async function call<T>(method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("auth_required");
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/vv-quantum-jobs`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `http_${res.status}`), { detail: data });
  return data as T;
}

export const fetchQuantumJobs = () => call<QuantumJobsResponse>("GET");

export const requestQuantumQuote = (args: {
  n_qubits: number; shots: number; idempotency_key: string;
  strategy_hash?: string; data_hash?: string;
}) => call<{ job: QuantumJob; config: QuantumJobsResponse["config"]; replay?: boolean }>("POST", { action: "quote", ...args });

export const authorizeQuantumJob = (jobId: string, approvedCapCents: number) =>
  call<{ job: QuantumJob }>("POST", { action: "authorize", job_id: jobId, approved_cap_cents: approvedCapCents });

export const dispatchQuantumJob = (jobId: string) =>
  call<{ job: QuantumJob }>("POST", { action: "dispatch", job_id: jobId });

export const cancelQuantumJob = (jobId: string) =>
  call<{ job: QuantumJob }>("POST", { action: "cancel", job_id: jobId });

export function formatCents(cents: number | null | undefined, currency = "usd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}
