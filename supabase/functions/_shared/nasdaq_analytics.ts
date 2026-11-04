/**
 * Nasdaq Composite daily-close analytics for the Vulture Vision Analytics page.
 * Reuses the exact validated Yahoo ^IXIC history reader already used by AutoSim.
 * All returns are OBSERVED; there are no live quotes, forecast odds or index trades.
 */
import { loadNasdaqCandles, nasdaqObservations, type SourceStatus } from "./autosim_data.ts";

export interface NasdaqAnalytics {
  symbol: "^IXIC";
  name: "Nasdaq Composite";
  source: string;
  as_of: string; // session date, YYYY-MM-DD (not an intraday quote timestamp)
  last_close: number; // index points, not USD
  previous_close: number;
  change_points: number;
  change_1d_pct: number;
  change_20_session_pct: number;
  realized_vol_20_session_annual_pct: number;
  history: { date: string; close: number }[];
}

export function buildNasdaqAnalytics(candles: { closes: number[]; dates: string[] }): NasdaqAnalytics {
  const { closes, dates } = candles;
  if (closes.length < 90 || dates.length !== closes.length) throw new Error("Nasdaq history unavailable");
  if (closes.some(value => !Number.isFinite(value) || value <= 0)) throw new Error("Invalid Nasdaq closing prices");
  if (dates.some((date, i) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || (i && date <= dates[i - 1]))) throw new Error("Invalid Nasdaq session dates");
  const obs = nasdaqObservations(candles);
  const daily = obs.nasdaq_daily_return?.value;
  const twenty = obs.nasdaq_20_session_return?.value;
  if (daily === undefined || twenty === undefined || !Number.isFinite(daily) || !Number.isFinite(twenty)) throw new Error("Missing Nasdaq observations");
  const n = closes.length;
  const sessionReturns = closes.slice(n - 21).map((value, i, array) => i ? Math.log(value / array[i - 1]) : null).slice(1) as number[];
  const mean = sessionReturns.reduce((sum, value) => sum + value, 0) / sessionReturns.length;
  const variance = sessionReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sessionReturns.length;
  const last = closes[n - 1], previous = closes[n - 2];
  return {
    symbol: "^IXIC", name: "Nasdaq Composite",
    source: obs.nasdaq_close?.source || "Yahoo Finance:^IXIC completed daily closes",
    as_of: dates[n - 1], last_close: last, previous_close: previous,
    change_points: last - previous, change_1d_pct: daily * 100,
    change_20_session_pct: twenty * 100,
    realized_vol_20_session_annual_pct: Math.sqrt(variance * 252) * 100,
    history: closes.slice(-60).map((close, i) => ({ date: dates[n - Math.min(n, 60) + i], close })),
  };
}

export async function loadNasdaqAnalytics(): Promise<{ nasdaq: NasdaqAnalytics | null; status: SourceStatus }> {
  try {
    const result = await loadNasdaqCandles();
    if (!result.status.ok) return { nasdaq: null, status: result.status };
    return { nasdaq: buildNasdaqAnalytics(result), status: result.status };
  } catch {
    return { nasdaq: null, status: { id: "yahoo:NASDAQ", ok: false, detail: "Nasdaq daily closing history unavailable or invalid" } };
  }
}
