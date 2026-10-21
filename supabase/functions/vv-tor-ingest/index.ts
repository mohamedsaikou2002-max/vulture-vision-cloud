import { authorize } from '../_shared/access.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

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
  const denied = await authorize(req, true);
  if (denied) return denied;
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 512_000) {
      return new Response(JSON.stringify({ error: "Payload exceeds 512 KB" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = JSON.parse(rawBody || "null");
    let raw: Incoming[] = [];
    if (Array.isArray(body?.entries)) {
      raw = body.entries;
    } else if (Array.isArray(body?.links)) {
      raw = body.links.map((l: string | (Incoming & {title?:string})) => ({
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

    if (raw.length > 500) {
      return new Response(JSON.stringify({ error: "At most 500 discovery entries may be ingested at once" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const invalid = raw.some((r) => {
      if (!r || typeof r !== "object" || typeof r.url !== "string" || !r.url.trim() || r.url.length > 2048) return true;
      if (r.name !== undefined && (typeof r.name !== "string" || r.name.length > 200)) return true;
      if (r.description !== undefined && (typeof r.description !== "string" || r.description.length > 2000)) return true;
      if (r.category !== undefined && (typeof r.category !== "string" || r.category.length > 64)) return true;
      if (r.status !== undefined && (typeof r.status !== "string" || r.status.length > 64)) return true;
      if (r.tags !== undefined && (!Array.isArray(r.tags) || r.tags.length > 20 || r.tags.some((tag) => typeof tag !== "string" || tag.length > 64))) return true;
      if (r.ping_ms !== undefined && r.ping_ms !== null && (typeof r.ping_ms !== "number" || !Number.isFinite(r.ping_ms) || r.ping_ms < 0 || r.ping_ms > 600_000)) return true;
      try { const url = new URL(r.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) return true; } catch { return true; }
      return false;
    });
    if (invalid) {
      return new Response(JSON.stringify({ error: "One or more discovery entries have invalid fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
