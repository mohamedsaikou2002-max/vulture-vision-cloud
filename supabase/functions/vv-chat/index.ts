import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");

    const system = "You are Vulture Vision, an elite intelligence synthesis AI. Analyze market data, news, and OSINT intel with precision. Be concise, analytical, and actionable. Speak in clipped operational tone.";

    let reply = "";

    if (ANTHROPIC) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system,
          messages: [{ role: "user", content: message }],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `Claude ${r.status}`);
      reply = j?.content?.[0]?.text || "[no response]";
    } else if (LOVABLE) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: message },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `Gateway ${r.status}`);
      reply = j?.choices?.[0]?.message?.content || "[no response]";
    } else {
      reply = "[No AI provider configured]";
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
