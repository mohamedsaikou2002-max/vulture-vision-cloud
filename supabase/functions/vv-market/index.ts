// MarketWorker — Bybit (crypto) + OANDA (forex).
// Returns a unified snapshot tick set. No long-lived sockets in edge runtime.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CRYPTO = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT",
  "XRPUSDT", "DOGEUSDT", "DOTUSDT", "LINKUSDT",
];
const DEFAULT_FOREX = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "NZD_USD"];

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

// ── Bybit ───────────────────────────────────────────────────
async function fetchBybit(instruments: string[]): Promise<Tick[]> {
  // Prod first — testnet often returns empty bid/ask. Fall back to testnet only on hard failure.
  let payload: any = null;
  try {
    const r1 = await fetch("https://api.bybit.com/v5/market/tickers?category=spot");
    if (r1.ok) payload = await r1.json();
  } catch { /* fall through */ }
  if (!payload?.result?.list?.length) {
    try {
      const r2 = await fetch("https://api-testnet.bybit.com/v5/market/tickers?category=spot");
      if (r2.ok) payload = await r2.json();
    } catch { /* ignore */ }
  }
  const list: any[] = payload?.result?.list ?? [];
  const want = new Set(instruments.map(s => s.toUpperCase()));
  const ts = Date.now();
  const byId: Record<string, Tick> = {};
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
    byId[r.symbol] = {
      id: r.symbol, exchange: "bybit",
      bid, ask, mid, spread_bps, last,
      change_24h_pct: parseFloat(r.price24hPcnt || "0") * 100,
      volume_24h: parseFloat(r.turnover24h || "0"),
      ofi, ts,
    };
  }
  return instruments.map(i => byId[i.toUpperCase()]).filter(Boolean) as Tick[];
}

// ── OANDA ───────────────────────────────────────────────────
async function fetchOanda(instruments: string[], token: string, accountId: string): Promise<Tick[]> {
  if (!token || !accountId) return [];
  const params = new URLSearchParams({ instruments: instruments.join(",") });
  const url = `https://api-fxpractice.oanda.com/v3/accounts/${accountId}/pricing?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  const ts = Date.now();
  const out: Tick[] = [];
  for (const p of data?.prices ?? []) {
    const bid = parseFloat(p?.bids?.[0]?.price || "0");
    const ask = parseFloat(p?.asks?.[0]?.price || "0");
    const mid = bid && ask ? (bid + ask) / 2 : 0;
    if (!mid) continue;
    out.push({
      id: p.instrument, exchange: "oanda",
      bid, ask, mid,
      spread_bps: ((ask - bid) / mid) * 10000,
      last: mid,
      change_24h_pct: 0,
      volume_24h: 0,
      ofi: 0,
      ts,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const cryptoParam = url.searchParams.get("crypto");
    const fxParam = url.searchParams.get("forex");
    const crypto = cryptoParam ? cryptoParam.split(",").map(s => s.trim().toUpperCase()) : DEFAULT_CRYPTO;
    const forex = fxParam ? fxParam.split(",").map(s => s.trim().toUpperCase()) : DEFAULT_FOREX;

    const token = Deno.env.get("OANDA_PRACTICE_TOKEN") || "";
    const accountId = Deno.env.get("OANDA_ACCOUNT_ID") || "";

    const [cryptoTicks, fxTicks] = await Promise.all([
      fetchBybit(crypto),
      fetchOanda(forex, token, accountId),
    ]);
    const ticks = [...cryptoTicks, ...fxTicks];
    const ofi: Record<string, number> = {};
    for (const t of ticks) ofi[`ofi_${t.id}`] = t.ofi;

    return new Response(JSON.stringify({
      exchanges: ["bybit", "oanda"],
      ticks, ofi,
      counts: { crypto: cryptoTicks.length, forex: fxTicks.length },
      ts: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), ticks: [], ofi: {} }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
