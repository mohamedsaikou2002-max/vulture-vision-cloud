import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

// Ingest TorBot JSON output. POST a JSON body shaped like:
// { entries: [ { name, url, description?, category?, status?, tags?, ping_ms? }, ... ] }
// or a raw TorBot crawl object { url, links: [...] } which we'll flatten.

interface Incoming {
  name?: string; url?: string; description?: string;
  category?: string; status?: string;
  tags?: string[]; ping_ms?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    let raw: Incoming[] = [];
    if (Array.isArray(body?.entries)) {
      raw = body.entries;
    } else if (Array.isArray(body?.links)) {
      raw = body.links.map((l: any) => ({
        url: typeof l === "string" ? l : l.url,
        name: typeof l === "object" ? (l.title || l.name || l.url) : l,
        description: typeof l === "object" ? l.description : "",
        category: "other",
        status: "unknown",
      }));
    } else if (Array.isArray(body)) {
      raw = body;
    } else {
      return new Response(JSON.stringify({ error: "expected { entries: [...] } or TorBot JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = raw
      .filter(r => r.url)
      .map(r => ({
        name: r.name || r.url!,
        url: r.url!,
        description: r.description || "",
        category: r.category || "other",
        status: r.status || "unknown",
        tags: r.tags || [],
        ping_ms: r.ping_ms ?? null,
        source: "torbot",
      }));

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supa.from("tor_entries").insert(rows);
    if (error) throw error;

    return new Response(JSON.stringify({ ingested: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
