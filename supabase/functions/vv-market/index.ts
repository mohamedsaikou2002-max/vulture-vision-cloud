// MarketWorker port — edge functions can't hold long-lived WS, so this is a
// stateless snapshot endpoint. Polls Binance public REST for bookTicker +
// 24hr stats across a default instrument set, normalizes, and returns an
// OFI proxy from bid/ask imbalance.

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
  ofi: number; // bid/ask size imbalance in [-1, 1]
  ts: number;
}

async function fetchBinance(instruments: string[]): Promise<Tick[]> {
  const symbolsParam = encodeURIComponent(JSON.stringify(instruments));
  const [bookRes, statsRes] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbols=${symbolsParam}`),
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`),
  ]);
  if (!bookRes.ok || !statsRes.ok) return [];
  const book = await bookRes.json() as any[];
  const stats = await statsRes.json() as any[];
  const statsBy: Record<string, any> = {};
  for (const s of stats) statsBy[s.symbol] = s;
  const ts = Date.now();
  return book.map(b => {
    const bid = parseFloat(b.bidPrice);
    const ask = parseFloat(b.askPrice);
    const bidQ = parseFloat(b.bidQty);
    const askQ = parseFloat(b.askQty);
    const mid = (bid + ask) / 2;
    const spread_bps = mid > 0 ? ((ask - bid) / mid) * 10000 : 0;
    const total = bidQ + askQ;
    const ofi = total > 0 ? (bidQ - askQ) / total : 0;
    const s = statsBy[b.symbol] || {};
    return {
      id: b.symbol,
      exchange: "binance",
      bid, ask, mid, spread_bps,
      last: parseFloat(s.lastPrice || `${mid}`),
      change_24h_pct: parseFloat(s.priceChangePercent || "0"),
      volume_24h: parseFloat(s.quoteVolume || "0"),
      ofi,
      ts,
    } as Tick;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const param = url.searchParams.get("instruments");
    const instruments = param ? param.split(",").map(s => s.trim().toUpperCase()) : DEFAULT_INSTRUMENTS;
    const ticks = await fetchBinance(instruments);
    const ofi: Record<string, number> = {};
    for (const t of ticks) ofi[`ofi_${t.id}`] = t.ofi;
    return new Response(JSON.stringify({
      exchange: "binance",
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
