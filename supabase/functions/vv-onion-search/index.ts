const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Live .onion search via Ahmia (clearnet endpoint that indexes Tor sites).
// No Tor proxy required. Parses the public HTML results page.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string") {
      return new Response(JSON.stringify({ error: "q required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 VultureVision/1.0" },
    });
    if (!r.ok) throw new Error(`Ahmia ${r.status}`);
    const html = await r.text();

    // Parse <li class="result"> blocks
    const results: { title: string; url: string; desc: string }[] = [];
    const liRe = /<li class="result"[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = liRe.exec(html)) && results.length < 30) {
      const block = m[1];
      const titleM = block.match(/<h4>\s*<a[^>]*>([\s\S]*?)<\/a>/);
      const urlM = block.match(/<cite>([\s\S]*?)<\/cite>/);
      const descM = block.match(/<p>([\s\S]*?)<\/p>/);
      const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (titleM && urlM) {
        results.push({
          title: strip(titleM[1]),
          url: strip(urlM[1]),
          desc: descM ? strip(descM[1]) : "",
        });
      }
    }

    return new Response(JSON.stringify({ results, source: "ahmia" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), results: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
