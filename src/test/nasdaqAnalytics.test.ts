import { describe, expect, it, afterEach, vi } from "vitest";
import { buildNasdaqAnalytics, loadNasdaqAnalytics } from "../../supabase/functions/_shared/nasdaq_analytics";
import { parseAnalyticsData } from "@/lib/analyticsData";

function sessionFixture(count = 115) {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (dates.length < count) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6)
      dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  dates.reverse();
  const closes = dates.map((_, i) => 17000 + i * 8 + Math.sin(i / 4) * 70);
  return { dates, closes };
}
afterEach(() => vi.unstubAllGlobals());

describe("Nasdaq Composite Analytics integration", () => {
  it("reuses the AutoSim Nasdaq session observations with index point units", () => {
    const input = sessionFixture();
    const r = buildNasdaqAnalytics(input);
    expect(r.symbol).toBe("^IXIC");
    expect(r.name).toBe("Nasdaq Composite");
    expect(r.source).toContain("^IXIC");
    expect(r.history).toHaveLength(60);
    expect(r.history.at(-1)).toEqual({ date: input.dates.at(-1), close: input.closes.at(-1) });
    expect(r.last_close).toBe(input.closes.at(-1));
    expect(r.previous_close).toBe(input.closes.at(-2));
    expect(r.change_1d_pct).toBeCloseTo(100 * (r.last_close / r.previous_close - 1));
    expect(r.change_20_session_pct).toBeCloseTo(100 * (r.last_close / input.closes[input.closes.length - 21] - 1));
    expect(r.realized_vol_20_session_annual_pct).toBeGreaterThan(0);
  });

  it("refuses invalid inputs instead of inventing values", () => {
    const input = sessionFixture();
    expect(() => buildNasdaqAnalytics({ dates: input.dates.slice(1), closes: input.closes })).toThrow();
    expect(() => buildNasdaqAnalytics({ dates: input.dates, closes: input.closes.map((v, i) => i === 3 ? NaN : v) })).toThrow();
    expect(() => buildNasdaqAnalytics({ dates: input.dates, closes: input.closes.slice(0, 30) })).toThrow();
  });

  it("validates the dashboard response and allows Nasdaq-only partial analytics", () => {
    const nasdaq = buildNasdaqAnalytics(sessionFixture());
    const data = { status: "degraded", crypto: [], assets: [], portfolio: null, nasdaq,
      source_health: [{ source: "Nasdaq Composite", status: "available", count: 60 }], ts: new Date().toISOString() };
    const parsed = parseAnalyticsData(data);
    expect(parsed.status).toBe("degraded");
    expect(parsed.nasdaq?.symbol).toBe("^IXIC");
    expect(() => parseAnalyticsData({ ...data, nasdaq: { ...nasdaq, last_close: nasdaq.last_close + 200 } })).toThrow("invalid data");
    expect(() => parseAnalyticsData({ ...data, nasdaq: null })).toThrow("unavailable");
  });

  it("degrades if Yahoo returns HTTP 429 instead of substituting predicted prices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const result = await loadNasdaqAnalytics();
    expect(result.nasdaq).toBeNull();
    expect(result.status.ok).toBe(false);
  });

  it("reads Yahoo's public chart data and excludes unfinished session data", async () => {
    const input = sessionFixture();
    const timestamp = input.dates.map(day => Math.floor(Date.parse(day + "T21:00:00Z") / 1000));
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      chart: { result: [{ timestamp, indicators: { quote: [{ close: input.closes }] } }] },
    }));
    vi.stubGlobal("fetch", fetcher);
    const result = await loadNasdaqAnalytics();
    expect(result.status.ok).toBe(true);
    expect(result.nasdaq?.last_close).toBe(input.closes.at(-1));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("%5EIXIC");
  });
});
