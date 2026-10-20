import { z } from 'zod';
const finite = z.number().finite();
const probability = finite.min(0).max(1);
const asset = z.object({
  symbol: z.string(), type: z.string(), regime: z.string(), rsi: finite.min(0).max(100), macd_hist: finite,
  stats: z.object({ sharpe_ratio: finite, ann_volatility: finite.min(0) }),
  mc_30d: z.object({ p50: finite.positive(), prob_up: probability, prob_down: probability }),
});
const schema = z.object({
  status: z.enum(['available', 'degraded', 'unavailable']).optional(),
  crypto: z.array(z.object({ symbol: z.string(), name: z.string(), price: finite.positive(), change_1h: finite.nullable(), change_24h: finite.nullable(), change_7d: finite.nullable(), market_cap: finite.min(0).nullable(), volume_24h: finite.min(0).nullable(), as_of: z.string().optional() })),
  assets: z.array(asset),
  portfolio: z.object({ dominant_regime: z.string(), avg_prob_up_30d: probability, avg_sharpe: finite }).nullable(),
  narrative: z.string().optional(), ts: z.string(),
  source_health: z.array(z.object({ source: z.string(), status: z.string(), count: finite })).optional(),
});
export function parseAnalyticsData(value: unknown, now = Date.now()) {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('The analytics service returned invalid data.');
  const data = result.data;
  const age = now - Date.parse(data.ts);
  if (!Number.isFinite(age) || age > 300000 || age < -60000) throw new Error('Market observations are stale. Refresh before using them.');
  if (data.status === 'unavailable' || (!data.crypto.length && !data.assets.length)) throw new Error('Market data is unavailable. No portfolio signal was calculated.');
  if (!data.assets.length) data.portfolio = null;
  const degraded = !data.portfolio || !data.crypto.length || !data.assets.length || !data.status || data.source_health?.some(source => source.status !== 'available');
  return { ...data, status: degraded ? 'degraded' as const : data.status };
}
