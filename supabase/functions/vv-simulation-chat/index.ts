// vv-simulation-chat — public Gemini research panel.
// Unlike the separate operator-only MiroFish engine, this answers research questions
// even when an engine is unavailable. Synthetic analyst roles are not live agents.
import { hasConfiguredAI, generateConfigured } from "../_shared/gemini.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parseSimulationChatRequest, buildSimulationChatPrompt, parseSimulationChatAnswer
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply({ error: "Chat service not configured" }, 503);
  if (!hasConfiguredAI()) return reply({ error: 'AI is not configured for simulation chat' }, 503);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Resolve cited IDs from server-owned evidence; client titles never establish provenance.
  if(request.news.length){
    const cutoff=new Date(Date.now()-72*3600000).toISOString();
    const {data:rows,error}=await admin.from('news_articles').select('id,title,translated_title_en,source,published_at').in('id',request.news.map(n=>n.id)).gte('published_at',cutoff).limit(8);
    if(error)return reply({error:'Research evidence verification unavailable'},503);
    if(rows?.length!==request.news.length)return reply({error:'Some source evidence is unavailable or stale; refresh the research context'},400);
    request.news=rows.map(r=>({id:r.id,title:(r.translated_title_en||r.title).slice(0,240),source:r.source.slice(0,100)}));
  }

  const prompt = buildSimulationChatPrompt(request);
  const generationBody = {
    systemInstruction: { parts: [{ text: prompt.system }] },
    contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2500, temperature: .35 },
  };
  try {
    const {text,model}=await generateConfigured(generationBody,40000);
    return reply(parseSimulationChatAnswer(text,request.mode,request.news.map(n=>n.id),model));
  } catch (e) {
    console.error("Simulation chat service failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Gemini response unavailable or invalid; no simulation was fabricated" }, 502);
  }
});
