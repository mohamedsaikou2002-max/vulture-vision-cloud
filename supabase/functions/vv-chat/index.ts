import { geminiFetch, hasGeminiKeys } from "../_shared/gemini_failover.ts";
import { validateChatMessage } from '../_shared/request_limits.ts';
import { authorize } from '../_shared/access.ts';
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

    if (!hasGeminiKeys()) throw new Error("GEMINI_API_KEY not configured");

    const system = "You are Vulture Vision, an elite intelligence synthesis AI. Analyze market data, news, and OSINT intel with precision. Be concise, analytical, and actionable. Speak in clipped operational tone.";

    const r = await geminiFetch("gemini-3.8-flash", JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }), 30000);
    const j = await r.json();
    if (!r.ok) {
      console.error("Gemini error:", r.status);
      throw new Error(j?.error?.message || `Gemini ${r.status}`);
    }
    const reply = j?.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("") || "[no response]";


    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
