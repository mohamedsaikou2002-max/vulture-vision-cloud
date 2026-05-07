// MarketWorker — Bybit edition.
// Polls Bybit v5 public spot tickers (no auth required) and returns a unified
// snapshot. Authenticated key/secret are reserved for future order endpoints.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_INSTRUMENTS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT",
  "XRPUSDT", "DOGEUSDT", "DOTUSDT", "LINKUSDT",
];

interface Tick {
  id: string;
  exchange: string;
  bid: number;
  ask: number;
  mid: number;
  spread_bps: number;
  last: number;
  change_24h_pct: number;
  volume_24h: number;
  ofi: number;
  ts: number;
}

async function fetchBybit(instruments: string[]): Promise<Tick[]> {
  // Bybit v5 spot tickers. One call returns all spot symbols; we filter.
  const res = await fetch("https://api-testnet.bybit.com/v5/market/tickers?category=spot");
  if (!res.ok) {
    // testnet sometimes empty for low-liquidity pairs — fall back to mainnet read-only
    const fb = await fetch("https://api.bybit.com/v5/market/tickers?category=spot");
    if (!fb.ok) return [];
    return parseBybit(await fb.json(), instruments);
  }
  return parseBybit(await res.json(), instruments);
}

function parseBybit(payload: any, instruments: string[]): Tick[] {
  const list: any[] = payload?.result?.list ?? [];
  const want = new Set(instruments.map(s => s.toUpperCase()));
  const ts = Date.now();
  const out: Tick[] = [];
  for (const r of list) {
    if (!want.has(r.symbol)) continue;
    const bid = parseFloat(r.bid1Price || "0");
    const ask = parseFloat(r.ask1Price || "0");
    const bidQ = parseFloat(r.bid1Size || "0");
    const askQ = parseFloat(r.ask1Size || "0");
    const last = parseFloat(r.lastPrice || "0");
    const mid = bid && ask ? (bid + ask) / 2 : last;
    const spread_bps = mid > 0 ? ((ask - bid) / mid) * 10000 : 0;
    const total = bidQ + askQ;
    const ofi = total > 0 ? (bidQ - askQ) / total : 0;
    out.push({
      id: r.symbol,
      exchange: "bybit",
      bid, ask, mid, spread_bps,
      last,
      change_24h_pct: parseFloat(r.price24hPcnt || "0") * 100,
      volume_24h: parseFloat(r.turnover24h || "0"),
      ofi,
      ts,
    });
  }
  // Preserve requested order
  const byId: Record<string, Tick> = {};
  for (const t of out) byId[t.id] = t;
  return instruments.map(i => byId[i.toUpperCase()]).filter(Boolean) as Tick[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const param = url.searchParams.get("instruments");
    const instruments = param ? param.split(",").map(s => s.trim().toUpperCase()) : DEFAULT_INSTRUMENTS;
    const ticks = await fetchBybit(instruments);
    const ofi: Record<string, number> = {};
    for (const t of ticks) ofi[`ofi_${t.id}`] = t.ofi;
    return new Response(JSON.stringify({
      exchange: "bybit",
      ticks,
      ofi,
      ts: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), ticks: [], ofi: {} }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
