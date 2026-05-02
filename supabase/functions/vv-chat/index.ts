const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

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
    let lastError = "";

    // Try Anthropic first
    if (ANTHROPIC) {
      try {
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
        if (r.ok) {
          reply = j?.content?.[0]?.text || "";
        } else {
          lastError = j?.error?.message || `Claude ${r.status}`;
          console.error("Anthropic failed, falling back:", lastError);
        }
      } catch (err) {
        lastError = String((err as Error).message);
        console.error("Anthropic threw:", lastError);
      }
    }

    // Fallback to Lovable AI Gateway
    if (!reply && LOVABLE) {
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
      if (!r.ok) {
        if (r.status === 429) throw new Error("Rate limit exceeded, try again shortly.");
        if (r.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
        throw new Error(j?.error?.message || `Gateway ${r.status}`);
      }
      reply = j?.choices?.[0]?.message?.content || "[no response]";
    }

    if (!reply) {
      reply = lastError ? `[AI offline: ${lastError}]` : "[No AI provider configured]";
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
