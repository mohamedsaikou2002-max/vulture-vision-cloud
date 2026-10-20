import {boundedBody} from '../_shared/stripe_billing.ts';
import { authorize } from '../_shared/access.ts';
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Live .onion search via Ahmia (clearnet endpoint that indexes Tor sites).
// No Tor proxy required. Parses the public HTML results page.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await authorize(req); if (denied) return denied;
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Use POST"}),{status:405,headers:corsHeaders});
  try {
    let q:unknown;try{q=JSON.parse(await boundedBody(req,2048)).q;}catch{return new Response(JSON.stringify({error:"Invalid or oversized search request"}),{status:400,headers:corsHeaders});}
    if (typeof q !== "string" || !q.trim() || q.length>240) {
      return new Response(JSON.stringify({ error: "Provide a search query of 1–240 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 VultureVision/1.0" }, signal:AbortSignal.timeout(8000),
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
    return new Response(JSON.stringify({ error: "Search provider unavailable", results: [] }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
