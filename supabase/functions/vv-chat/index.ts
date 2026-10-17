import { validateChatMessage } from '../_shared/request_limits.ts';
import { authorize } from '../_shared/access.ts';
import { availableGeminiModels } from '../_shared/simulation_chat_contract.ts';
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await authorize(req, true);
  if (denied) return denied;

  try {
    if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:corsHeaders});
    const raw=await req.text();
    if(new TextEncoder().encode(raw).byteLength>40000)return new Response(JSON.stringify({error:"Message payload too large"}),{status:413,headers:corsHeaders});
    let message:string;
    try {message=validateChatMessage(JSON.parse(raw).message);}
    catch(e){return new Response(JSON.stringify({error:(e as Error).message}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});}

    const GEMINI = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI) throw new Error("GEMINI_API_KEY not configured");

    const system = "You are Vulture Vision, an elite intelligence synthesis AI. Analyze market data, news, and OSINT intel with precision. Be concise, analytical, and actionable. Speak in clipped operational tone.";

    const models = availableGeminiModels(Deno.env.get("GEMINI_MODEL"));
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    });
    let reply: string | null = null;
    for (const model of models) {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
          signal: AbortSignal.timeout(30000),
          body: requestBody,
        },
      );
      // Some legacy 2.5 deployments are no longer eligible for new projects.
      // Only an explicit 404 may fall back; no automatic retry on ambiguous
      // errors that could duplicate billed requests.
      if (r.status === 404) {
        console.warn("Vulture AI model unavailable; trying allowed fallback:", model);
        continue;
      }
      if (!r.ok) {
        console.error("Vulture AI upstream response", r.status);
        throw new Error(r.status === 429 ? "AI provider rate limit reached" : "AI provider unavailable");
      }
      const result = await r.json();
      const generated = result?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "").join("") || "";
      if (!generated.trim()) throw new Error("AI provider returned an empty response");
      reply = generated;
      break;
    }
    if (reply === null) throw new Error("No accessible Gemini model is configured");


    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
