// vv-simulation-chat — user-authenticated Gemini research panel.
// Unlike the separate operator-only MiroFish engine, this answers research questions
// even when an engine is unavailable. Synthetic analyst roles are not live agents.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paidAccessForUser } from "../_shared/paid_access.ts";
import {
  parseSimulationChatRequest, buildSimulationChatPrompt, parseSimulationChatAnswer, availableGeminiModels
} from "../_shared/simulation_chat_contract.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const raw = await req.text().catch(() => "");
  if (new TextEncoder().encode(raw).byteLength > 30000) return reply({ error: "Chat request too large" }, 413);
  let request;
  try { request = parseSimulationChatRequest(JSON.parse(raw)); }
  catch (e) { return reply({ error: e instanceof Error ? e.message : "Invalid request" }, 400); }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) return reply({ error: "Chat service not configured" }, 503);
  const bearer = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply({ error: "Sign in required" }, 401);
  const identity = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await identity.auth.getUser(bearer);
  if (!user || authError) return reply({ error: "Invalid session" }, 401);
  const unpaid = await paidAccessForUser(user.id);
  if (unpaid) return unpaid;

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return reply({ error: "Gemini is not configured for simulation chat" }, 503);
  let models: string[];
  try { models = availableGeminiModels(Deno.env.get("GEMINI_MODEL")); }
  catch { return reply({ error: "Invalid Gemini model configuration" }, 503); }

  // Existing service-role-only RPC atomically enforces 6 synthesis calls per user per hour.
  // If migrations aren't deployed, fail closed rather than make unmetered provider calls.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: claimed, error: claimError } = await admin.rpc("claim_scenario_synthesis", { p_user_id: user.id });
  if (claimError) return reply({ error: "Simulation chat quota is unavailable; deploy the quota migration" }, 503);
  if (claimed !== true) return reply({ error: "Hourly simulation research limit reached (6 calls)" }, 429);

  const prompt = buildSimulationChatPrompt(request);
  const generationBody = JSON.stringify({
    systemInstruction: { parts: [{ text: prompt.system }] },
    contents: [{ role: "user", parts: [{ text: prompt.user }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2500, temperature: 0.35 },
  });
  try {
    for (const model of models) {
      const upstream = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          signal: AbortSignal.timeout(40000),
          body: generationBody,
        }
      );
      // Older 2.5 models may be restricted for new Google API projects.
      // A 404 is a model-access/configuration failure, not billable inference success.
      if (upstream.status === 404) {
        console.warn("Gemini model unavailable (404); trying another supported model", model);
        continue;
      }
      if (!upstream.ok) {
        console.error("Simulation Gemini provider failure", upstream.status);
        return reply({ error: upstream.status === 429 ? "Gemini is rate-limited" : "Gemini request failed" }, 502);
      }
      const result = await upstream.json();
      const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
      const validated = parseSimulationChatAnswer(text, request.mode, request.news.map(n => n.id), model);
      return reply(validated);
    }
    return reply({ error: "No supported Gemini model is accessible for the configured API key" }, 503);
  } catch (e) {
    console.error("Simulation chat service failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Gemini response unavailable or invalid; no simulation was fabricated" }, 502);
  }
});
