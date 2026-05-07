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
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch { body = {}; }

    if (!body.instrument) {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
      const { data, error } = await db.from("trade_history")
        .select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      const totalPnl = (data || []).reduce((s, t: any) => s + Number(t.pnl || 0), 0);
      return new Response(JSON.stringify({ trades: data, total_pnl: totalPnl, count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instrument, side, qty, price, pnl, mode = "paper", meta = {} } = body;
    if (!side || qty == null || price == null) {
      return new Response(JSON.stringify({ error: "instrument, side, qty, price required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await db.from("trade_history")
      .insert({ instrument, side, qty, price, pnl, mode, meta }).select().single();
    if (error) throw error;
    return new Response(JSON.stringify({ trade: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
