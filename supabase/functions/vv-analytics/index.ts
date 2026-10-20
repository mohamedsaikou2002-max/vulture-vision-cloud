import { authorize } from '../_shared/access.ts';
import { hasConfiguredAI, generateConfigured } from '../_shared/gemini.ts';
import { summarizeMarketStatus, type MarketSource } from '../_shared/market_status.ts';
const fetchMarket: typeof fetch = (input, init = {}) => fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(8000) });
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Live market analytics. CoinGecko for crypto, Stooq for SPY/equities (no key).
// Computes classical indicators and illustrative scenario estimates.
// These are not calibrated predictions.

interface Crypto {
  symbol: string; name: string; price: number;
  change_1h: number | null; change_24h: number | null; change_7d: number | null;
  market_cap: number | null; volume_24h: number | null; as_of: string;
}
interface Asset {
  symbol: string; type: string; regime: string;
  rsi: number; macd_hist: number;
  stats: { sharpe_ratio: number; ann_volatility: number };
  mc_30d: { p50: number; prob_up: number; prob_down: number };
}

async function fetchCryptoPrimary(): Promise<Crypto[]> {
  const ids = "bitcoin,ethereum,solana,cardano,ripple,dogecoin,polkadot,chainlink";
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=1h,24h,7d`;
  const r = await fetchMarket(url, { headers: { "User-Agent": "VultureVision/1.0" } });
  if (!r.ok) throw new Error("Market source unavailable");
  const data = await r.json() as {id:string;symbol:string;name:string;current_price:number;price_change_percentage_24h:number;price_change_percentage_1h_in_currency?:number;price_change_percentage_24h_in_currency?:number;price_change_percentage_7d_in_currency?:number;market_cap:number;total_volume:number;last_updated:string;sparkline_in_7d?:{price:number[]}}[];
  if (!Array.isArray(data)) throw new Error("Invalid market data");
  return data.filter(d => Number.isFinite(d.current_price) && d.current_price > 0 && Number.isFinite(Date.parse(d.last_updated)) && Date.now() - Date.parse(d.last_updated) >= -60000 && Date.now() - Date.parse(d.last_updated) < 3600000).map(d => ({
    symbol: d.symbol.toUpperCase(),
    name: d.name,
    price: d.current_price,
    change_1h: d.price_change_percentage_1h_in_currency ?? null,
    change_24h: d.price_change_percentage_24h_in_currency ?? null,
    change_7d: d.price_change_percentage_7d_in_currency ?? null,
    market_cap: d.market_cap,
    volume_24h: d.total_volume,
    as_of: d.last_updated,
  }));
}

async function fetchCrypto(): Promise<Crypto[]> {
  try{const primary=await fetchCryptoPrimary();if(primary.length)return primary;}catch{/* Independent public quote provider below. */}
  const rows=await Promise.allSettled(['BTC','ETH','SOL'].map(async symbol=>{
    const chart=await yahooChart(symbol+'-USD','1d');const meta=chart.meta;
    const asOf=Number(meta?.regularMarketTime)*1000,price=Number(meta?.regularMarketPrice);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(asOf)||Date.now()-asOf>3600000||asOf>Date.now()+60000)throw new Error('Quote stale');
    return {symbol,name:symbol,price,change_1h:null,change_24h:null,change_7d:null,market_cap:null,volume_24h:null,as_of:new Date(asOf).toISOString()};
  }));
  return rows.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
}
async function yahooChart(symbol:string, range:string){
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{const response=await fetchMarket(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`);
      if(!response.ok)continue;
      const data=await response.json();if(data?.chart?.result?.[0])return data.chart.result[0];
    }catch{/* Read-only requests can fail over to another market host. */}
  }
  throw new Error('Market history unavailable');
}

async function fetchHistory(geckoId: string, days = 60): Promise<number[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const r = await fetchMarket(url);
  if (!r.ok) throw new Error("Market source unavailable");
  const j = await r.json();
  if (!Array.isArray(j.prices)) throw new Error("Invalid price history");
  const observations = (j.prices as [number, number][]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0);
  if (!observations.length || Date.now() - observations[observations.length - 1][0] > 4 * 86400000) throw new Error("Price history is stale");
  return observations.map(p => p[1]);
}

async function yahooHistory(symbol: string): Promise<number[]> {
  const chart=await yahooChart(symbol,'6mo');
  const pairs=(chart?.timestamp||[]).map((t:number,i:number)=>[t,chart.indicators?.quote?.[0]?.close?.[i]]).filter((p:number[])=>Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[1]>0);
  if(pairs.length<35 || Date.now()/1000-pairs.at(-1)[0]>5*86400)throw new Error('History unavailable or stale');
  return pairs.map((p:number[])=>p[1]);
}
async function fetchStooq(symbol:string):Promise<number[]> {
  try{return await yahooHistory(symbol.replace(/\.us$/i,''));}
  catch {return await stooqHistory(symbol);}
}
async function stooqHistory(symbol: string): Promise<number[]> {
  // Daily CSV — last ~6 months
  const r = await fetchMarket(`https://stooq.com/q/d/l/?s=${symbol}&i=d`);
  if (!r.ok) throw new Error("Market source unavailable");
  const text = await r.text();
  const rows = text.trim().split("\n").slice(1);
  const lastDate = Date.parse(rows[rows.length - 1]?.split(",")[0] || "");
  if (!Number.isFinite(lastDate) || Date.now() - lastDate > 5 * 86400000) throw new Error("Equity history is stale");
  const closes = rows.map(line => parseFloat(line.split(",")[4])).filter(n => Number.isFinite(n) && n > 0);
  return closes.slice(-90);
}

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  if (gains === 0 && losses === 0) return 50;
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

function statsFor(prices: number[], periodsPerYear = 252) {
  if (prices.length < 5) return { sharpe_ratio: 0, ann_volatility: 0, mu: 0, sigma: 0 };
  const r = returns(prices);
  const mu = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length;
  const sigma = Math.sqrt(variance);
  const annVol = sigma * Math.sqrt(periodsPerYear);
  const sharpe = sigma === 0 ? 0 : (mu * periodsPerYear) / (sigma * Math.sqrt(periodsPerYear));
  return { sharpe_ratio: sharpe, ann_volatility: annVol, mu, sigma };
}

// Standard normal CDF
function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function monteCarlo30d(price: number, mu: number, sigma: number, days = 30) {
  if (!price || !sigma) return { p50: price, prob_up: 0.5, prob_down: 0.5 };
  const muT = mu * days;
  const sigT = sigma * Math.sqrt(days);
  const p50 = price * Math.exp(muT);
  // P(price_T > price_0) = P(Z > -muT/sigT) = 1 - N(-muT/sigT)
  const probUp = 1 - ncdf(-muT / Math.max(sigT, 1e-9));
  return { p50, prob_up: probUp, prob_down: 1 - probUp };
}

function regimeFor(prices: number[], rsiV: number, periodsPerYear = 252): string {
  if (prices.length < 20) return "SIDEWAYS";
  const recent = prices.slice(-20);
  const slope = (recent[recent.length - 1] - recent[0]) / recent[0];
  const vol = statsFor(prices, periodsPerYear).ann_volatility;
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
  const s = statsFor(prices, type === "CRYPTO" ? 365 : 252);
  const reg = regimeFor(prices, rsiV, type === "CRYPTO" ? 365 : 252);
  const mc = monteCarlo30d(price, s.mu, s.sigma, type === "CRYPTO" ? 30 : 21);
  return {
    symbol, type, regime: reg,
    rsi: rsiV, macd_hist: macdH,
    stats: { sharpe_ratio: s.sharpe_ratio, ann_volatility: s.ann_volatility },
    mc_30d: mc,
  };
}

async function aiNarrative(crypto: Crypto[], assets: Asset[], port: {dominant_regime:string;avg_prob_up_30d:number}): Promise<string> {
  if (!hasConfiguredAI()) return "AI synthesis unavailable — no provider is configured.";

  const prompt = `VULTURE VISION INTEL BRIEF — ${new Date().toISOString()}

Top crypto:
${crypto.slice(0, 5).map(c => `${c.symbol} ${c.price} 24h:${c.change_24h == null ? 'unavailable' : c.change_24h.toFixed(2)}%`).join("\n")}

Asset signals (regime, RSI):
${assets.map(a => `${a.symbol} ${a.regime} RSI:${a.rsi.toFixed(1)}`).join("\n")}

Portfolio: regime=${port.dominant_regime} P↑30d=${(port.avg_prob_up_30d * 100).toFixed(1)}%

Provide a 4-sentence intelligence brief: market sentiment, dominant narrative, key risks, conviction. Tight clipped operational tone.`;

  try {
    const result = await generateConfigured({
      systemInstruction: { parts: [{ text: "You are Vulture Vision. Use only the supplied observations. State missing data and uncertainty. Indicators are uncalibrated research signals, not investment advice." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.35 },
    });
    return result.text;
  } catch {
    return "AI synthesis unavailable. Quantitative observations remain available below.";
  }
}


// Ethereum mainnet gas only. Whale coverage requires a real transfer indexer;
// never represent a zero-address or testnet query as market-wide whale activity.
async function fetchOnchain() {
  const base = { chain: "ethereum-mainnet", whales: [], whale_status: "not_configured" };
  const key = Deno.env.get("ETHERSCAN_API_KEY");
  if (!key) return { ...base, gas: null, gas_status: "not_configured" };
  try {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.search = new URLSearchParams({ chainid: "1", module: "gastracker", action: "gasoracle", apikey: key }).toString();
    const response = await fetchMarket(url);
    if (!response.ok) throw new Error("Gas source unavailable");
    const data = await response.json();
    const result = data.result;
    const prices = [result?.FastGasPrice, result?.ProposeGasPrice, result?.SafeGasPrice].map(Number);
    if (data.status !== "1" || prices.some(n => !Number.isFinite(n) || n < 0)) throw new Error("Invalid gas data");
    return { ...base, gas_status: "available", gas: { fast: prices[0], average: prices[1], slow: prices[2], ts_us: Date.now() * 1000 } };
  } catch { return { ...base, gas: null, gas_status: "unavailable" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await authorize(req, true);
  if (denied) return denied;
  try {
    const sources: MarketSource[] = [];
    async function collect<T>(source: string, operation: () => Promise<T[]>, minimum = 1): Promise<T[]> {
      try {
        const values = await operation();
        if (values.length < minimum) throw new Error("Insufficient observations");
        sources.push({ source, status: "available", count: values.length });
        return values;
      } catch {
        sources.push({ source, status: "unavailable", count: 0 });
        return [];
      }
    }
    const crypto = await collect("Crypto prices (CoinGecko / Yahoo)", fetchCrypto);
    const assets: Asset[] = [];
    await Promise.all([
      ...["BTC", "ETH", "SOL", "ADA"].map(async sym => {
        const c = crypto.find(row => row.symbol === sym);
        if (!c) { sources.push({ source: sym + " history", status: "unavailable", count: 0 }); return; }
        const history = await collect(sym + " history", () => fetchHistory(SYMBOL_TO_GECKO[sym]).catch(()=>yahooHistory(sym+"-USD")), 35);
        if (history.length) assets.push(await buildAsset(sym, "CRYPTO", c.price, history));
      }),
      ...[{ sym: "SPY", stooq: "spy.us" }, { sym: "QQQ", stooq: "qqq.us" }, { sym: "GLD", stooq: "gld.us" }].map(async asset => {
        const history = await collect(asset.sym + " history", () => fetchStooq(asset.stooq), 35);
        if (history.length) assets.push(await buildAsset(asset.sym, "EQUITY", history[history.length - 1], history));
      }),
    ]);
    assets.sort((a, b) => a.symbol.localeCompare(b.symbol));
    const status = summarizeMarketStatus(crypto.length, assets.length, sources);
    if (status === "unavailable") return new Response(JSON.stringify({ status, error: "Market data is unavailable. No portfolio signal was calculated.", crypto: [], assets: [], portfolio: null, source_health: sources, ts: new Date().toISOString() }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Portfolio aggregates
    const counts: Record<string, number> = {};
    let sSum = 0, pSum = 0, n = 0;
    for (const a of assets) {
      counts[a.regime] = (counts[a.regime] || 0) + 1;
      sSum += a.stats.sharpe_ratio; pSum += a.mc_30d.prob_up; n++;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const portfolio = n ? {
      dominant_regime: dominant,
      avg_sharpe: n ? sSum / n : 0,
      avg_prob_up_30d: n ? pSum / n : 0,
    } : null;

    const narrative = portfolio ? await aiNarrative(crypto, assets, portfolio) : "Insufficient history for a portfolio narrative.";
    const onchain = await fetchOnchain();

    return new Response(JSON.stringify({
      status, source_health: sources, crypto, assets, portfolio, narrative, onchain, ts: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Analytics service unavailable" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
