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
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
      const { data, error } = await db.from("kill_switch_alerts")
        .select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      // also fetch active flag from warm_state
      const { data: ks } = await db.from("warm_state")
        .select("value").eq("key", "kill_switch_active").maybeSingle();
      return new Response(JSON.stringify({
        active: ks?.value === true,
        alerts: data,
        count: data?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Safely parse body (may be empty when used as a GET-like fetch)
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch { body = {}; }

    // No reason => treat as a read request
    if (!body.reason) {
      const { data, error } = await db.from("kill_switch_alerts")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const { data: ks } = await db.from("warm_state")
        .select("value").eq("key", "kill_switch_active").maybeSingle();
      return new Response(JSON.stringify({
        active: ks?.value === true,
        alerts: data,
        count: data?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST" || req.method === "GET") {
      const { level = "warning", reason, source, payload = {}, set_active } = body;
      const { data, error } = await db.from("kill_switch_alerts")
        .insert({ level, reason, source, payload }).select().single();
      if (error) throw error;
      if (typeof set_active === "boolean") {
        await db.from("warm_state").upsert(
          { key: "kill_switch_active", value: set_active as any },
          { onConflict: "key" },
        );
      }
      return new Response(JSON.stringify({ alert: data }), {
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
