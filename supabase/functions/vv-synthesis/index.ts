import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supa = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = supa();
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const { data, error } = await db.from("synthesis_history")
        .select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ entries: data, count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.method === "POST") {
      const body = await req.json();
      const { thesis, antithesis, synthesis, narrative, score } = body || {};
      const { data, error } = await db.from("synthesis_history")
        .insert({ thesis, antithesis, synthesis, narrative, score }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ entry: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
