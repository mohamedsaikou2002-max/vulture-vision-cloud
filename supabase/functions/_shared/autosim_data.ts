// Live observables for AutoSim. Every fetch is optional: a missing key or failed request is reported
// as unavailable and the affected dimension falls back to a labelled neutral default.
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
      obs[id] = { value: v, observed_at: rows[0].date, source: `FRED:${series}` };
      status.push({ id: `fred:${series}`, ok: true, detail: `latest ${rows[0].date}` });
    } catch (e) { status.push({ id: `fred:${series}`, ok: false, detail: (e as Error).message }); }
  }));
  return { obs, status };
}

export const SUPPORTED_ASSETS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "LINK-USD", "AVAX-USD"];

// Coinbase Exchange public candles — no key needed. Returns up to 300 daily closes, oldest first.
export async function loadCandles(product: string): Promise<{ closes: number[]; dates: string[]; status: SourceStatus }> {
  try {
    const r = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400`, { headers: { "User-Agent": "vulture-vision" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Coinbase ${r.status}`);
    const rows: number[][] = await r.json(); // [time, low, high, open, close, volume], newest first
    const sorted = rows.sort((a, b) => a[0] - b[0]);
    if (sorted.length < 90) throw new Error("fewer than 90 daily candles returned");
    return { closes: sorted.map(x => x[4]), dates: sorted.map(x => new Date(x[0] * 1000).toISOString().slice(0, 10)), status: { id: `coinbase:${product}`, ok: true, detail: `${sorted.length} daily candles to ${new Date(sorted[sorted.length - 1][0] * 1000).toISOString().slice(0, 10)}` } };
  } catch (e) {
    return { closes: [], dates: [], status: { id: `coinbase:${product}`, ok: false, detail: (e as Error).message } };
  }
}
