const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Live market analytics. CoinGecko for crypto, Stooq for SPY/equities (no key).
// Computes derived signals (RSI/MACD-hist proxies, quantum-style amplitude,
// Monte Carlo bands, Sharpe, vol, regime) and an AI narrative via Anthropic
// or Lovable AI Gateway as fallback.

interface Crypto {
  symbol: string; name: string; price: number;
  change_1h: number; change_24h: number; change_7d: number;
  market_cap: number; volume_24h: number;
}
interface Asset {
  symbol: string; type: string; regime: string;
  rsi: number; macd_hist: number;
  quantum: { score: number; interference: number; entanglement: number };
  stats: { sharpe_ratio: number; ann_volatility: number };
  mc_30d: { p50: number; prob_up: number; prob_down: number };
}

async function fetchCrypto(): Promise<Crypto[]> {
  const ids = "bitcoin,ethereum,solana,cardano,ripple,dogecoin,polkadot,chainlink";
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=1h,24h,7d`;
  const r = await fetch(url, { headers: { "User-Agent": "VultureVision/1.0" } });
  if (!r.ok) return [];
  const data = await r.json() as any[];
  return data.map(d => ({
    symbol: d.symbol.toUpperCase(),
    name: d.name,
    price: d.current_price,
    change_1h: d.price_change_percentage_1h_in_currency ?? 0,
    change_24h: d.price_change_percentage_24h_in_currency ?? 0,
    change_7d: d.price_change_percentage_7d_in_currency ?? 0,
    market_cap: d.market_cap,
    volume_24h: d.total_volume,
  }));
}

async function fetchHistory(geckoId: string, days = 60): Promise<number[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.prices as [number, number][]).map(p => p[1]);
}

async function fetchStooq(symbol: string): Promise<number[]> {
  // Daily CSV — last ~6 months
  const r = await fetch(`https://stooq.com/q/d/l/?s=${symbol}&i=d`);
  if (!r.ok) return [];
  const text = await r.text();
  const rows = text.trim().split("\n").slice(1);
  const closes = rows.map(line => parseFloat(line.split(",")[4])).filter(n => !isNaN(n));
  return closes.slice(-90);
}

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const rs = gains / Math.max(losses, 1e-9);
  return 100 - 100 / (1 + rs);
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function macdHist(prices: number[]): number {
  if (prices.length < 35) return 0;
  const e12 = ema(prices, 12);
  const e26 = ema(prices, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signal = ema(macdLine.slice(-35), 9);
  return macdLine[macdLine.length - 1] - signal[signal.length - 1];
}

function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) r.push(Math.log(prices[i] / prices[i - 1]));
  return r;
}

function statsFor(prices: number[]) {
  if (prices.length < 5) return { sharpe_ratio: 0, ann_volatility: 0, mu: 0, sigma: 0 };
  const r = returns(prices);
  const mu = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length;
  const sigma = Math.sqrt(variance);
  const annVol = sigma * Math.sqrt(252);
  const sharpe = sigma === 0 ? 0 : (mu * 252) / (sigma * Math.sqrt(252));
  return { sharpe_ratio: sharpe, ann_volatility: annVol, mu, sigma };
}

// Standard normal CDF
function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function monteCarlo30d(price: number, mu: number, sigma: number) {
  if (!price || !sigma) return { p50: price, prob_up: 0.5, prob_down: 0.5 };
  const days = 30;
  const muT = mu * days;
  const sigT = sigma * Math.sqrt(days);
  const p50 = price * Math.exp(muT);
  // P(price_T > price_0) = P(Z > -muT/sigT) = 1 - N(-muT/sigT)
  const probUp = 1 - ncdf(-muT / Math.max(sigT, 1e-9));
  return { p50, prob_up: probUp, prob_down: 1 - probUp };
}

function quantumScore(rsiV: number, macdH: number, sharpe: number, regime: string): { score: number; interference: number; entanglement: number } {
  // Born-rule style amplitude: combine normalized indicators into [0,1].
  const rsiN = Math.min(Math.max((rsiV - 30) / 40, 0), 1);          // 30→0, 70→1
  const macdN = 1 / (1 + Math.exp(-macdH * 50));                    // sigmoid
  const sharpeN = 1 / (1 + Math.exp(-sharpe));                      // sigmoid
  // amplitudes
  const a1 = Math.sqrt(rsiN), a2 = Math.sqrt(macdN), a3 = Math.sqrt(sharpeN);
  // interference (cross terms)
  const interference = 2 * (a1 * a2 + a2 * a3 + a1 * a3) / 6;
  // entanglement proxy = product
  const entanglement = a1 * a2 * a3;
  // born probability via avg of squared amplitudes weighted by regime
  const w = regime === "BULL" ? 1.1 : regime === "BEAR" ? 0.85 : 1.0;
  const score = Math.min(1, w * ((a1 ** 2 + a2 ** 2 + a3 ** 2) / 3));
  return { score, interference, entanglement };
}

function regimeFor(prices: number[], rsiV: number): string {
  if (prices.length < 20) return "SIDEWAYS";
  const recent = prices.slice(-20);
  const slope = (recent[recent.length - 1] - recent[0]) / recent[0];
  const vol = statsFor(prices).ann_volatility;
  if (vol > 1.0) return "VOLATILE";
  if (slope > 0.05 && rsiV > 55) return "BULL";
  if (slope < -0.05 && rsiV < 45) return "BEAR";
  return "SIDEWAYS";
}

const SYMBOL_TO_GECKO: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano",
  XRP: "ripple", DOGE: "dogecoin", DOT: "polkadot", LINK: "chainlink",
};

async function buildAsset(symbol: string, type: "CRYPTO" | "EQUITY", price: number, prices: number[]): Promise<Asset> {
  const rsiV = rsi(prices);
  const macdH = macdHist(prices);
  const s = statsFor(prices);
  const reg = regimeFor(prices, rsiV);
  const q = quantumScore(rsiV, macdH, s.sharpe_ratio, reg);
  const mc = monteCarlo30d(price, s.mu, s.sigma);
  return {
    symbol, type, regime: reg,
    rsi: rsiV, macd_hist: macdH,
    quantum: q,
    stats: { sharpe_ratio: s.sharpe_ratio, ann_volatility: s.ann_volatility },
    mc_30d: mc,
  };
}

async function aiNarrative(crypto: Crypto[], assets: Asset[], port: any): Promise<string> {
  const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC) return "AI synthesis offline — ANTHROPIC_API_KEY not configured.";

  const prompt = `VULTURE VISION INTEL BRIEF — ${new Date().toISOString()}

Top crypto:
${crypto.slice(0, 5).map(c => `${c.symbol} ${c.price} 24h:${c.change_24h.toFixed(2)}%`).join("\n")}

Asset signals (regime, RSI, quantum score):
${assets.map(a => `${a.symbol} ${a.regime} RSI:${a.rsi.toFixed(1)} Q:${a.quantum.score.toFixed(3)}`).join("\n")}

Portfolio: regime=${port.dominant_regime} avgQ=${port.avg_quantum_score.toFixed(3)} P↑30d=${(port.avg_prob_up_30d * 100).toFixed(1)}%

Provide a 4-sentence intelligence brief: market sentiment, dominant narrative, key risks, conviction. Tight clipped operational tone.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: "You are Vulture Vision. Be concise, analytical, operational.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error("Claude narrative error:", r.status, j);
      return `AI synthesis error: ${j?.error?.message || r.status}`;
    }
    return j?.content?.[0]?.text || "";
  } catch (e) {
    console.error("Claude narrative threw:", e);
    return "AI synthesis offline — engine running on raw quantitative signals only.";
  }
}

// ===== OnChain (Etherscan Sepolia) =====
const ETHERSCAN_URL = "https://api-sepolia.etherscan.io/api";
const WHALE_THRESHOLD_USD = 50_000;

async function fetchOnchain(ethUsd: number) {
  const key = Deno.env.get("ETHERSCAN_API_KEY");
  if (!key) return { gas: null, whales: [] as any[] };
  const gasP = fetch(`${ETHERSCAN_URL}?module=gastracker&action=gasoracle&apikey=${key}`).then(r => r.json()).catch(() => null);
  const txP = fetch(`${ETHERSCAN_URL}?module=account&action=txlist&address=0x0000000000000000000000000000000000000000&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${key}`).then(r => r.json()).catch(() => null);
  const [gasRes, txRes] = await Promise.all([gasP, txP]);
  let gas = null;
  if (gasRes?.status === "1") {
    const r = gasRes.result;
    gas = {
      fast: parseFloat(r.FastGasPrice || "0"),
      average: parseFloat(r.ProposeGasPrice || "0"),
      slow: parseFloat(r.SafeGasPrice || "0"),
      ts_us: Date.now() * 1000,
    };
  }
  const whales: any[] = [];
  if (txRes?.status === "1") {
    for (const tx of (txRes.result || [])) {
      const eth = Number(tx.value || 0) / 1e18;
      const usd = eth * ethUsd;
      if (usd >= WHALE_THRESHOLD_USD) {
        whales.push({
          tx_hash: tx.hash, value_usd: usd,
          from_addr: tx.from, to_addr: tx.to,
          ts: Number(tx.timeStamp || 0),
        });
      }
      if (whales.length >= 50) break;
    }
  }
  return { gas, whales };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const crypto = await fetchCrypto();

    const cryptoSymbols = ["BTC", "ETH", "SOL", "ADA"];
    const assets: Asset[] = [];

    // Crypto assets
    for (const sym of cryptoSymbols) {
      const c = crypto.find(x => x.symbol === sym);
      if (!c) continue;
      const hist = await fetchHistory(SYMBOL_TO_GECKO[sym], 60);
      if (hist.length) assets.push(await buildAsset(sym, "CRYPTO", c.price, hist));
    }

    // Equity proxies via Stooq
    const equities = [
      { sym: "SPY", stooq: "spy.us" },
      { sym: "QQQ", stooq: "qqq.us" },
      { sym: "GLD", stooq: "gld.us" },
    ];
    for (const e of equities) {
      const hist = await fetchStooq(e.stooq);
      if (hist.length) assets.push(await buildAsset(e.sym, "EQUITY", hist[hist.length - 1], hist));
    }

    // Portfolio aggregates
    const counts: Record<string, number> = {};
    let qSum = 0, sSum = 0, pSum = 0, n = 0;
    for (const a of assets) {
      counts[a.regime] = (counts[a.regime] || 0) + 1;
      qSum += a.quantum.score; sSum += a.stats.sharpe_ratio; pSum += a.mc_30d.prob_up; n++;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "SIDEWAYS";
    const portfolio = {
      dominant_regime: dominant,
      avg_quantum_score: n ? qSum / n : 0,
      avg_sharpe: n ? sSum / n : 0,
      avg_prob_up_30d: n ? pSum / n : 0,
    };

    const narrative = await aiNarrative(crypto, assets, portfolio);
    const ethUsd = crypto.find(c => c.symbol === "ETH")?.price || 3000;
    const onchain = await fetchOnchain(ethUsd);

    return new Response(JSON.stringify({
      crypto, assets, portfolio, narrative, onchain, ts: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
