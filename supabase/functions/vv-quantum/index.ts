// vv-quantum — quantum backend selector, status, signals, structured logs.
// - GET            → backend status + last cached quantum state (warm_state)
// - POST           → run amplitudes through analytic Born-rule or BlueQubit cloud
// - POST ?signals  → derive amplitudes from live market ticks, persist results
//
// Structured JSON logs (one line per event) are emitted to stdout for the
// Lovable Cloud log pipeline. A tiny per-IP token-bucket rate limiter caps
// abuse without needing external infra.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const LOCAL_QUBIT_CAP = 10;
const RL_CAPACITY = 30;            // burst
const RL_REFILL_PER_SEC = 0.5;     // sustained = 30 req/min
const QSTATE_KEY = "quantum_state";
const QHIST_KEY = "quantum_history";

// ── structured logger ───────────────────────────────────────
function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "vv-quantum", event, ...data }));
}

// ── token-bucket rate limit (in-memory; per isolate) ────────
const buckets = new Map<string, { tokens: number; ts: number }>();
function rateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now() / 1000;
  const b = buckets.get(ip) ?? { tokens: RL_CAPACITY, ts: now };
  const refill = (now - b.ts) * RL_REFILL_PER_SEC;
  b.tokens = Math.min(RL_CAPACITY, b.tokens + refill);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(ip, b); return { ok: false, remaining: 0 }; }
  b.tokens -= 1;
  buckets.set(ip, b);
  return { ok: true, remaining: Math.floor(b.tokens) };
}

// ── quantum kernels ─────────────────────────────────────────
function analyticBornRule(amps: number[]) {
  const norm = Math.sqrt(amps.reduce((a, b) => a + b * b, 0)) || 1;
  const psi = amps.map((a) => a / norm);
  const probs = psi.map((a) => a * a);
  const H = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const maxH = Math.log2(probs.length || 2);
  const coherence = maxH > 0 ? H / maxH : 0;
  // dominant basis state index = argmax(probs)
  const dominant = probs.reduce((best, p, i) => (p > probs[best] ? i : best), 0);
  // top-k states
  const top = probs
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 8);
  return { probs, coherence, dominant, top, backend: "analytic_born_rule" as const };
}

async function bluequbitRun(amps: number[], nQubits: number, key: string) {
  const r = await fetch("https://app.bluequbit.io/api/v1/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      device: "cpu", shots: 1024, job_type: "statevector",
      payload: { amplitudes: amps, n_qubits: nQubits },
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`bluequbit ${r.status}: ${text}`);
  return { ...JSON.parse(text), backend: "bluequbit" as const };
}

// Build a 2^n amplitude vector from market ticks.
// Each instrument contributes one amplitude proportional to |ofi| + vol.
function ampsFromTicks(ticks: any[], nQubits: number): { amps: number[]; labels: string[] } {
  const dim = 2 ** nQubits;
  const labels: string[] = [];
  const amps = new Array(dim).fill(0);
  for (let i = 0; i < Math.min(ticks.length, dim); i++) {
    const t = ticks[i];
    const ofi = Math.abs(Number(t.ofi) || 0);
    const ch = Math.abs(Number(t.change_24h_pct) || 0);
    amps[i] = Math.sqrt(ofi + ch + 0.01);
    labels.push(t.id ?? `q${i}`);
  }
  return { amps, labels };
}

// ── handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(ip);
  if (!rl.ok) {
    log("rate_limited", { ip });
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "Retry-After": "30" },
    });
  }

  const key = Deno.env.get("BLUEQUBIT_KEY") ?? "";
  const cloudAvailable = key.length > 0;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── GET: status + last cached state ───────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const includeState = url.searchParams.get("state") !== "0";
    let last: any = null;
    if (includeState) {
      const { data } = await sb.from("warm_state").select("value").eq("key", QSTATE_KEY).maybeSingle();
      last = data?.value ?? null;
    }
    log("status", { cloud: cloudAvailable, ip, ms: Date.now() - t0 });
    return new Response(JSON.stringify({
      backends: {
        analytic_born_rule: { available: true, max_qubits: LOCAL_QUBIT_CAP },
        bluequbit:          { available: cloudAvailable, max_qubits: 36 },
      },
      default: cloudAvailable ? "auto" : "analytic_born_rule",
      last_state: last,
      ts: new Date().toISOString(),
    }), { headers: corsHeaders });
  }

  // ── POST: run circuit / derive signals ────────────────────
  try {
    const url = new URL(req.url);
    const wantSignals = url.searchParams.has("signals");
    const body = (await req.json().catch(() => ({}))) as any;
    const prefer: "analytic" | "cloud" | "auto" = body.prefer ?? "auto";
    let nQubits: number = body.n_qubits ?? 4;
    let amps: number[];
    let labels: string[] = [];

    if (wantSignals) {
      // Pull live market snapshot from sibling edge function.
      nQubits = Math.max(2, Math.min(LOCAL_QUBIT_CAP, body.n_qubits ?? 4));
      const m = await sb.functions.invoke("vv-market");
      const ticks = (m.data?.ticks ?? []) as any[];
      const built = ampsFromTicks(ticks, nQubits);
      amps = built.amps; labels = built.labels;
      log("signals_input", { instruments: ticks.length, n_qubits: nQubits });
    } else {
      amps = body.amplitudes ?? [1, 0];
      nQubits = body.n_qubits ?? Math.max(1, Math.round(Math.log2(amps.length)));
    }

    const useCloud = prefer === "cloud" ||
      (prefer === "auto" && cloudAvailable && nQubits > LOCAL_QUBIT_CAP);

    let out: any;
    if (useCloud && cloudAvailable) {
      try {
        out = await bluequbitRun(amps, nQubits, key);
        log("cloud_ok", { n_qubits: nQubits });
      } catch (e) {
        log("cloud_fallback", { reason: (e as Error).message, n_qubits: nQubits });
        out = analyticBornRule(amps);
      }
    } else {
      out = analyticBornRule(amps);
    }

    const result = {
      ok: true,
      n_qubits: nQubits,
      labels,
      ...out,
      ts: new Date().toISOString(),
    };

    // Persist latest state + append to history (best-effort).
    await sb.from("warm_state").upsert(
      { key: QSTATE_KEY, value: result, expires_at: null },
      { onConflict: "key" },
    );
    if (wantSignals) {
      const { data: prev } = await sb.from("warm_state").select("value").eq("key", QHIST_KEY).maybeSingle();
      const hist = Array.isArray(prev?.value) ? prev!.value : [];
      hist.push({ ts: result.ts, coherence: result.coherence, dominant: result.dominant, backend: result.backend });
      await sb.from("warm_state").upsert(
        { key: QHIST_KEY, value: hist.slice(-50), expires_at: null },
        { onConflict: "key" },
      );
    }

    log("done", { backend: out.backend, coherence: out.coherence, ms: Date.now() - t0 });
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (e) {
    log("error", { message: (e as Error).message });
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
