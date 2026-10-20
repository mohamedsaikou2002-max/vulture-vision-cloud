// Live observables for AutoSim. Every fetch is optional: a missing key or failed request is reported
// as unavailable and the affected dimension falls back to a labelled neutral default.
declare const Deno: { env: { get(name: string): string | undefined } };
import type { Observables } from "./autosim_engine.ts";

export interface SourceStatus { id: string; ok: boolean; detail: string }

const FRED = "https://api.stlouisfed.org/fred/series/observations";
async function fred(series: string, key: string, limit = 14): Promise<{ date: string; value: number }[]> {
  const url = `${FRED}?series_id=${series}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`FRED ${series} ${r.status}`);
  const j = await r.json();
  return (j.observations ?? []).filter((o: { value: string }) => o.value !== ".").map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }));
}
const yoy = (obs: { date: string; value: number }[]) => (obs.length > 12 ? obs[0].value / obs[12].value - 1 : NaN);

export async function loadMacroObservables(): Promise<{ obs: Observables; status: SourceStatus[] }> {
  const key = Deno.env.get("FRED_API_KEY");
  const obs: Observables = {}; const status: SourceStatus[] = [];
  if (!key) return { obs, status: [{ id: "fred", ok: false, detail: "FRED_API_KEY not set — macro dimensions use neutral defaults" }] };
  const jobs: [string, string, (o: { date: string; value: number }[]) => number, number][] = [
    ["vix", "VIXCLS", o => o[0].value, 5], ["hy_spread", "BAMLH0A0HYM2", o => o[0].value, 5],
    ["curve_10y2y", "T10Y2Y", o => o[0].value, 5], ["unrate", "UNRATE", o => o[0].value, 3],
    ["cpi_yoy", "CPIAUCSL", yoy, 14], ["nfci", "NFCI", o => o[0].value, 3],
    ["umcsent", "UMCSENT", o => o[0].value, 3], ["retail_yoy", "RSAFS", yoy, 14],
  ];
  await Promise.all(jobs.map(async ([id, series, pick, limit]) => {
    try {
      const rows = await fred(series, key, limit);
      const v = rows.length ? pick(rows) : NaN;
      if (!Number.isFinite(v)) throw new Error("no usable observations");
      const maxAge=['unrate','cpi_yoy','umcsent','retail_yoy'].includes(id)?70:id==='nfci'?21:7;
      const age=(Date.now()-Date.parse(rows[0].date))/86400000;
      if(!Number.isFinite(age)||age < -1||age > maxAge)throw new Error('Latest observation is stale or undated');
      obs[id] = { value: v, observed_at: rows[0].date, source: `FRED:${series}` };
      status.push({ id: `fred:${series}`, ok: true, detail: `latest ${rows[0].date}` });
    } catch (e) { status.push({ id: `fred:${series}`, ok: false, detail: (e as Error).message }); }
  }));
  return { obs, status };
}

export const SUPPORTED_ASSETS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "LINK-USD", "AVAX-USD"];

// Coinbase Exchange public candles — no key needed. Returns up to 300 daily closes, oldest first.
export function validCandles(rows: unknown, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Invalid candle response');
  const today = Math.floor(now / 86400000) * 86400;
  const completed = new Map<number, number>();
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 6 || r.some(n => typeof n !== 'number' || !Number.isFinite(n)) || r[0] % 86400 !== 0 || r[1] <= 0 || r[2] < r[1] || r[3] < r[1] || r[3] > r[2] || r[4] < r[1] || r[4] > r[2] || r[5] < 0) throw new Error('Invalid candle observation');
    if (r[0] >= today) continue;
    if (completed.has(r[0])) throw new Error('Duplicate candle date');
    completed.set(r[0], r[4]);
  }
  const sorted = [...completed].sort((a,b)=>a[0]-b[0]);
  if (sorted.length < 90 || today - sorted[sorted.length-1][0] > 4*86400) throw new Error('Insufficient or stale completed candles');
  if (sorted.some((r,i)=>i>0 && r[0]-sorted[i-1][0]!==86400)) throw new Error('Incomplete daily history');
  return { closes: sorted.map(r=>r[1]), dates: sorted.map(r=>new Date(r[0]*1000).toISOString().slice(0,10)) };
}
export async function loadCandles(product: string): Promise<{ closes: number[]; dates: string[]; status: SourceStatus }> {
  try {
    const r = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400`, { headers: { "User-Agent": "vulture-vision" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Coinbase ${r.status}`);
    const { closes, dates } = validCandles(await r.json());
    return { closes, dates, status: { id: `coinbase:${product}`, ok: true, detail: `${closes.length} completed daily candles to ${dates.at(-1)}` } };
  } catch (e) {
    return { closes: [], dates: [], status: { id: `coinbase:${product}`, ok: false, detail: (e as Error).message } };
  }
}
