// Live observables for AutoSim. Every fetch is optional: a missing key or failed request is reported
// as unavailable and the affected dimension falls back to a labelled neutral default.
declare const Deno: { env: { get(name: string): string | undefined } };
import type { Observables } from "./autosim_engine.ts";

export interface SourceStatus { id: string; ok: boolean; detail: string }

// AbortSignal.timeout is missing in some runtimes (e.g. jsdom tests); a timed-out fetch there is better than a crash.
const timeoutSignal = (ms: number): AbortSignal | undefined => {
  try { return AbortSignal.timeout(ms); } catch { return undefined; }
};

const FRED = "https://api.stlouisfed.org/fred/series/observations";
async function fred(series: string, key: string, limit = 14): Promise<{ date: string; value: number }[]> {
  const url = `${FRED}?series_id=${series}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const r = await fetch(url, { signal: timeoutSignal(8000) });
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

// The simulated market is the Nasdaq Composite index — not any single crypto asset.
export const NASDAQ_MARKET = { label: "NASDAQ Composite", symbol: "^IXIC" } as const;

// Yahoo Finance chart API daily closes for ^IXIC — no key needed. Weekends and market holidays
// appear as missing or null entries and are skipped; trading-day gaps are valid daily returns.
export function validCandles(payload: unknown, now = Date.now()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid chart response");
  const chart = (payload as { chart?: { result?: unknown[] } }).chart?.result?.[0];
  if (!chart || typeof chart !== "object") throw new Error("Invalid chart response");
  const r = chart as { timestamp?: unknown; indicators?: { quote?: { close?: unknown }[] } };
  const ts = r.timestamp, close = r.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close) || ts.length !== close.length) throw new Error("Invalid chart response");
  const completed = new Map<number, number>();
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i], v = close[i];
    if (typeof t !== "number" || !Number.isInteger(t) || v === null) continue; // market holiday placeholder
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new Error("Invalid chart observation");
    const day = Math.floor(t / 86400) * 86400;
    if (completed.has(day)) throw new Error("Duplicate candle date");
    completed.set(day, v);
  }
  const sorted = [...completed].sort((a, b) => a[0] - b[0]);
  if (sorted.length < 90 || now / 1000 - sorted[sorted.length - 1][0] > 5 * 86400) throw new Error("Insufficient or stale completed candles");
  if (sorted.some((r, i) => i > 0 && r[0] - sorted[i - 1][0] > 10 * 86400)) throw new Error("Multi-week gap in daily history");
  return { closes: sorted.map(r => r[1]), dates: sorted.map(r => new Date(r[0] * 1000).toISOString().slice(0, 10)) };
}
export async function loadNasdaqCandles(): Promise<{ closes: number[]; dates: string[]; status: SourceStatus }> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(NASDAQ_MARKET.symbol)}?interval=1d&range=1y`, { headers: { "User-Agent": "vulture-vision" }, signal: timeoutSignal(8000) });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const { closes, dates } = validCandles(await r.json());
    return { closes, dates, status: { id: "yahoo:NASDAQ", ok: true, detail: `${closes.length} completed daily closes to ${dates.at(-1)}` } };
  } catch (e) {
    return { closes: [], dates: [], status: { id: "yahoo:NASDAQ", ok: false, detail: (e as Error).message } };
  }
}
