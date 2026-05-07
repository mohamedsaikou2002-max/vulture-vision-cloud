// vv-mirofish — regime/verdict engine.
// Mirofish layer fuses market microstructure (OFI, vol, drift) with the
// latest quantum coherence to produce a directional verdict + confidence.
// Persisted to warm_state.mirofish_verdict for synthesis & UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "vv-mirofish", event, ...data }));

function classify(ticks: any[], coherence: number) {
  if (!ticks.length) return { verdict: "NO_DATA", confidence: 0, drift: 0, ofi: 0 };
  const drift = ticks.reduce((s, t) => s + (Number(t.change_24h_pct) || 0), 0) / ticks.length;
  const ofi = ticks.reduce((s, t) => s + (Number(t.ofi) || 0), 0) / ticks.length;
  const absDrift = Math.abs(drift);
  // Confidence rises with coherence and signal magnitude.
  const confidence = Math.min(1, coherence * 0.6 + Math.min(absDrift / 5, 1) * 0.4);
  let verdict: string;
  if (absDrift < 0.3 && Math.abs(ofi) < 0.05) verdict = "RANGE";
  else if (drift > 0 && ofi > 0) verdict = "RISK_ON";
  else if (drift < 0 && ofi < 0) verdict = "RISK_OFF";
  else verdict = "MIXED";
  return { verdict, confidence, drift, ofi };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // GET → return latest cached verdict
    if (req.method === "GET") {
      const { data } = await sb.from("warm_state").select("value").eq("key", "mirofish_verdict").maybeSingle();
      return new Response(JSON.stringify({ ok: true, verdict: data?.value ?? null }), { headers: corsHeaders });
    }

    // POST → recompute
    const [m, q] = await Promise.all([
      sb.functions.invoke("vv-market"),
      sb.from("warm_state").select("value").eq("key", "quantum_state").maybeSingle(),
    ]);
    const ticks = (m.data?.ticks ?? []) as any[];
    const coherence = Number(q.data?.value?.coherence ?? 0);
    const v = classify(ticks, coherence);
    const verdict = { ...v, coherence, instruments: ticks.length, ts: new Date().toISOString() };

    await sb.from("warm_state").upsert(
      { key: "mirofish_verdict", value: verdict, expires_at: null },
      { onConflict: "key" },
    );

    log("verdict", { ...v, ms: Date.now() - t0 });
    return new Response(JSON.stringify({ ok: true, verdict }), { headers: corsHeaders });
  } catch (e) {
    log("error", { message: (e as Error).message });
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
