// vv-quantum-jobs — optional IBM Quantum pay-per-job state machine.
// States: quoted → authorized → dispatched → settled | failed | cancelled | refunded
// Rules enforced here (server-side only):
//  - No paid job without Stripe configured AND a processor-confirmed authorization.
//  - No dispatch without IBM credentials configured.
//  - Idempotent: (user_id, idempotency_key) is unique; replays return the existing job.
//  - Hard cap: settlement may never exceed approved_cap_cents.
//  - Ledger is append-only via quantum_job_events; never simulates payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeQuote, isQuoteExpired, capValid, canAuthorize, canDispatch,
  validIdempotencyKey, DEFAULT_CONFIG, type QuantumRateConfig,
} from "../_shared/quantum_billing.ts";

interface JobMeterSummary {
  id: string; created_at: string; status: string;
  charge_cents: number | null; refund_cents: number | null;
  provider_reported_qpu_secs: number | null;
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "vv-quantum-jobs", event, ...data }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── authenticate ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer /i, "");
  if (!token) return json({ error: "auth_required" }, 401);
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "auth_invalid" }, 401);
  const userId = userData.user.id;

  // ── load rate config (server-side only) ───────────────────
  const { data: cfgRow } = await sb.from("quantum_billing_config").select("*").eq("id", 1).maybeSingle();
  const cfg: QuantumRateConfig = { ...DEFAULT_CONFIG, ...(cfgRow || {}) };
  // Truth comes from actual secrets, not the flag alone.
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const ibmKey = Deno.env.get("IBM_QUANTUM_API_KEY") || "";
  cfg.stripe_configured = cfg.stripe_configured && stripeKey.length > 0;
  cfg.ibm_configured = cfg.ibm_configured && ibmKey.length > 0;

  const configState = {
    stripe_configured: cfg.stripe_configured,
    ibm_configured: cfg.ibm_configured,
    currency: cfg.currency,
    max_qubits: cfg.max_qubits,
    markup_bp: cfg.markup_bp,
  };

  // ── GET: user's jobs + events + period totals ─────────────
  if (req.method === "GET") {
    const { data: jobs } = await sb
      .from("quantum_jobs").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(100);
    const ids = (jobs || []).map((j: JobMeterSummary) => j.id);
    let events: Record<string, unknown>[] = [];
    if (ids.length) {
      const { data } = await sb.from("quantum_job_events").select("*").in("job_id", ids)
        .order("created_at", { ascending: false }).limit(500);
      events = data || [];
    }
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const period = (jobs || []).filter((j: JobMeterSummary) => j.created_at >= monthStart.toISOString());
    const totals = {
      jobs: period.length,
      charged_cents: period.reduce((s: number, j: JobMeterSummary) => s + (j.charge_cents || 0), 0),
      refunded_cents: period.reduce((s: number, j: JobMeterSummary) => s + (j.refund_cents || 0), 0),
      qpu_secs: period.reduce((s: number, j: JobMeterSummary) => s + (Number(j.provider_reported_qpu_secs) || 0), 0),
      pending: period.filter((j: JobMeterSummary) => ["quoted", "authorized", "dispatched"].includes(j.status)).length,
    };
    return json({ config: configState, jobs: jobs || [], events, period_totals: totals });
  }

  // ── POST actions ──────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  const recordEvent = async (jobId: string, event: string, data: Record<string, unknown> = {}) => {
    await sb.from("quantum_job_events").insert({ job_id: jobId, event, data });
  };

  // ── quote ─────────────────────────────────────────────────
  if (action === "quote") {
    const nQubits = Math.floor(Number(body.n_qubits));
    const shots = Math.floor(Number(body.shots));
    if (!Number.isFinite(nQubits) || nQubits < 1 || nQubits > cfg.max_qubits) {
      return json({ error: "invalid_n_qubits", max: cfg.max_qubits }, 400);
    }
    if (!Number.isFinite(shots) || shots < 1 || shots > 100000) {
      return json({ error: "invalid_shots" }, 400);
    }
    if (!validIdempotencyKey(body.idempotency_key)) {
      return json({ error: "invalid_idempotency_key" }, 400);
    }
    // Idempotent replay: return existing job for the same key.
    const { data: existing } = await sb.from("quantum_jobs").select("*")
      .eq("user_id", userId).eq("idempotency_key", body.idempotency_key).maybeSingle();
    if (existing) {
      log("quote_replay", { job: existing.id });
      return json({ job: existing, config: configState, replay: true });
    }
    const quote = computeQuote(nQubits, shots, cfg);
    const { data: job, error } = await sb.from("quantum_jobs").insert({
      user_id: userId,
      idempotency_key: body.idempotency_key,
      status: "quoted",
      n_qubits: nQubits,
      shots,
      strategy_hash: typeof body.strategy_hash === "string" ? body.strategy_hash.slice(0, 128) : null,
      data_hash: typeof body.data_hash === "string" ? body.data_hash.slice(0, 128) : null,
      est_qpu_secs: quote.est_qpu_secs,
      quote_cents: quote.quote_cents,
      quote_expires_at: quote.expires_at,
      currency: quote.currency,
      rate_snapshot: {
        provider_rate_cents_per_qpu_sec: cfg.provider_rate_cents_per_qpu_sec,
        markup_bp: cfg.markup_bp,
        provider_cost_cents: quote.provider_cost_cents,
        markup_cents: quote.markup_cents,
      },
    }).select().single();
    if (error) {
      if (String(error.code) === "23505") { // unique violation = concurrent replay
        const { data: dup } = await sb.from("quantum_jobs").select("*")
          .eq("user_id", userId).eq("idempotency_key", body.idempotency_key).maybeSingle();
        return json({ job: dup, config: configState, replay: true });
      }
      log("quote_error", { message: error.message });
      return json({ error: "quote_failed" }, 500);
    }
    await recordEvent(job.id, "quoted", { quote });
    log("quoted", { job: job.id, cents: quote.quote_cents });
    return json({ job, config: configState });
  }

  // ── authorize (explicit user approval of a maximum charge) ─
  if (action === "authorize") {
    const { data: job } = await sb.from("quantum_jobs").select("*")
      .eq("id", body.job_id).eq("user_id", userId).maybeSingle();
    if (!job) return json({ error: "job_not_found" }, 404);
    if (job.status !== "quoted") return json({ error: "invalid_state", status: job.status }, 409);
    if (isQuoteExpired(job.quote_expires_at)) {
      await sb.from("quantum_jobs").update({ status: "expired" }).eq("id", job.id);
      await recordEvent(job.id, "quote_expired");
      return json({ error: "quote_expired" }, 410);
    }
    const block = canAuthorize(cfg);
    if (block) {
      await recordEvent(job.id, "authorize_blocked", { reason: block });
      return json({ error: block, config: configState }, 402);
    }
    const cap = Math.floor(Number(body.approved_cap_cents));
    if (!capValid(cap, job.quote_cents)) {
      return json({ error: "cap_below_quote", quote_cents: job.quote_cents }, 400);
    }
    // Payment authorization via Stripe would happen here. Never mark paid
    // without processor confirmation — stripe_configured guarantees a key,
    // but a real PaymentIntent confirm call is required before proceeding.
    // (Adapter boundary: see stripeConfirmAuthorization below.)
    const confirm = await stripeConfirmAuthorization(stripeKey, cap, job.currency, job.id);
    if (!confirm.ok) {
      await recordEvent(job.id, "payment_authorization_failed", { reason: confirm.error });
      return json({ error: "payment_authorization_failed", detail: confirm.error }, 402);
    }
    const { data: updated } = await sb.from("quantum_jobs").update({
      status: "authorized",
      approved_cap_cents: cap,
      authorized_at: new Date().toISOString(),
      payment_provider: "stripe",
      payment_intent_id: confirm.payment_intent_id,
      payment_status: "authorized",
    }).eq("id", job.id).eq("status", "quoted").select().single();
    if (!updated) return json({ error: "state_conflict" }, 409);
    await recordEvent(job.id, "authorized", { cap_cents: cap, payment_intent_id: confirm.payment_intent_id });
    log("authorized", { job: job.id, cap });
    return json({ job: updated, config: configState });
  }

  // ── dispatch (server-side only; never from browser directly to IBM) ──
  if (action === "dispatch") {
    const { data: job } = await sb.from("quantum_jobs").select("*")
      .eq("id", body.job_id).eq("user_id", userId).maybeSingle();
    if (!job) return json({ error: "job_not_found" }, 404);
    if (job.status !== "authorized") return json({ error: "invalid_state", status: job.status }, 409);
    if (job.payment_status !== "authorized") return json({ error: "payment_not_authorized" }, 402);
    const block = canDispatch(cfg);
    if (block) {
      await recordEvent(job.id, "dispatch_blocked", { reason: block });
      return json({ error: block, config: configState }, 402);
    }
    // IBM dispatch adapter — submits with explicit usage limits. Not reached
    // unless IBM credentials are configured.
    const dispatch = await ibmDispatch(ibmKey, job);
    if (!dispatch.ok) {
      await recordEvent(job.id, "dispatch_failed", { reason: dispatch.error });
      return json({ error: "dispatch_failed", detail: dispatch.error }, 502);
    }
    const { data: updated } = await sb.from("quantum_jobs").update({
      status: "dispatched",
      backend: dispatch.backend,
      provider_job_id: dispatch.provider_job_id,
    }).eq("id", job.id).eq("status", "authorized").select().single();
    if (!updated) return json({ error: "state_conflict" }, 409);
    await recordEvent(job.id, "dispatched", { provider_job_id: dispatch.provider_job_id });
    log("dispatched", { job: job.id, provider_job: dispatch.provider_job_id });
    return json({ job: updated, config: configState });
  }

  // ── cancel ────────────────────────────────────────────────
  if (action === "cancel") {
    const { data: job } = await sb.from("quantum_jobs").select("*")
      .eq("id", body.job_id).eq("user_id", userId).maybeSingle();
    if (!job) return json({ error: "job_not_found" }, 404);
    if (!["quoted", "authorized"].includes(job.status)) {
      return json({ error: "invalid_state", status: job.status }, 409);
    }
    const { data: updated } = await sb.from("quantum_jobs").update({
      status: "cancelled", settlement_status: "voided",
    }).eq("id", job.id).select().single();
    await recordEvent(job.id, "cancelled");
    return json({ job: updated, config: configState });
  }

  return json({ error: "unknown_action" }, 400);
});

// ── Adapter boundaries (production-ready interfaces) ────────
// These are only called when the corresponding secret exists. They never
// simulate success: any failure returns ok:false and blocks the flow.

async function stripeConfirmAuthorization(
  _key: string, _capCents: number, _currency: string, _jobId: string,
): Promise<{ ok: boolean; payment_intent_id?: string; error?: string }> {
  // Real implementation: create+confirm a PaymentIntent with capture_method=manual
  // (prepayment hold) for capCents, return its id. Reached only when
  // STRIPE_SECRET_KEY is set; until the Stripe dependency is deployed this
  // boundary reports incomplete configuration rather than faking success.
  return { ok: false, error: "stripe_adapter_not_deployed" };
}

async function ibmDispatch(
  _key: string, _job: unknown,
): Promise<{ ok: boolean; provider_job_id?: string; backend?: string; error?: string }> {
  // Real implementation: submit to IBM Quantum Runtime with max_execution_time
  // and provider usage limits. Reached only when IBM_QUANTUM_API_KEY is set.
  return { ok: false, error: "ibm_adapter_not_deployed" };
}
