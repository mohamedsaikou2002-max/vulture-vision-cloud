import { MAX_REQUEST_BYTES, validateSeedSize } from '../_shared/simulation_payload.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paidAccessForUser } from "../_shared/paid_access.ts";

// Operator-only pilot gateway. Keep the engine private; never put its token in VITE variables.
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Content-Type": "application/json" };
const allowed = [/^\/api\/report\/generate$/, /^\/api\/report\/by-simulation\/[a-zA-Z0-9_-]+$/, /^\/health$/, /^\/api\/graph\/ontology\/generate$/, /^\/api\/graph\/build$/, /^\/api\/graph\/task\/[a-zA-Z0-9_-]+$/, /^\/api\/graph\/project\/[a-zA-Z0-9_-]+$/, /^\/api\/simulation\/(create|prepare|start|stop)$/, /^\/api\/simulation\/[a-zA-Z0-9_-]+\/run-status$/];
Deno.serve(async req => {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return reply({ error: "Sign in required" }, 401);
  const unpaid = await paidAccessForUser(user.id);
  if (unpaid) return unpaid;
  const operators = (Deno.env.get("MIROFISH_ALLOWED_USER_IDS") ?? "").split(",").map(s => s.trim());
  if (!operators.includes(user.id)) return reply({ error: "Simulation pilot access is not enabled for this account" }, 403);
  const base = Deno.env.get("MIROFISH_URL");
  const token = Deno.env.get("MIROFISH_GATEWAY_TOKEN");
  if (!base || !token) return reply({ error: "Simulation engine has not been configured" }, 503);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return reply({ error: "Payload too large" }, 413);
    const { path, method = "GET", payload, seed } = JSON.parse(raw);
    if (typeof path !== "string" || !allowed.some(r => r.test(path)) || !["GET", "POST"].includes(method)) return reply({ error: "Unsupported engine operation" }, 400);
    const upstreamHeaders: Record<string, string> = { "X-Vulture-Gateway-Token": token };
    let body: BodyInit | undefined;
    if (path === "/api/graph/ontology/generate") {
      if (method !== "POST" || typeof seed !== "string" || !seed.trim() || typeof payload?.simulation_requirement !== "string") return reply({ error: "Invalid seed document" }, 400);
      try { validateSeedSize(seed); } catch (e) { return reply({ error: (e as Error).message }, 400); }
      const form = new FormData();
      form.append("files", new Blob([seed], { type: "text/markdown" }), "vulture-seed.md");
      form.append("simulation_requirement", payload.simulation_requirement);
      form.append("project_name", "Vulture Vision scenario");
      body = form;
    } else if (method === "POST") {
      if (path === "/api/simulation/start" && (!Number.isInteger(payload?.max_rounds) || payload.max_rounds < 1 || payload.max_rounds > 24)) return reply({ error: "Pilot runs support 1–24 rounds" }, 400);
      upstreamHeaders["Content-Type"] = "application/json";
      body = JSON.stringify(payload ?? {});
    }
    const upstream = await fetch(base.replace(/\/$/, "") + path, { method, headers: upstreamHeaders, body, signal: AbortSignal.timeout(150000) });
    const data = await upstream.json();
    if (!upstream.ok || data.success === false) return reply({ error: "Engine operation failed", upstream_status: upstream.status }, 502);
    return reply(data);
  } catch { return reply({ error: "Simulation service unavailable or timed out" }, 502); }
});
