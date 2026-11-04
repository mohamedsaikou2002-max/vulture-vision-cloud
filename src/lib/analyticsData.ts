import { z } from 'zod';
const finite = z.number().finite();
const probability = finite.min(0).max(1);
const asset = z.object({
  symbol: z.string(), type: z.string(), regime: z.string(), rsi: finite.min(0).max(100), macd_hist: finite,
  stats: z.object({ sharpe_ratio: finite, ann_volatility: finite.min(0) }),
  mc_30d: z.object({ p50: finite.positive(), prob_up: probability, prob_down: probability }),
});
const nasdaq = z.object({
  symbol: z.literal('^IXIC'), name: z.literal('Nasdaq Composite'), source: z.string().min(1),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_close: finite.positive(), previous_close: finite.positive(), change_points: finite,
  change_1d_pct: finite, change_20_session_pct: finite,
  realized_vol_20_session_annual_pct: finite.min(0),
  history: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), close: finite.positive() })).min(20).max(60),
}).superRefine((index, ctx) => {
  const tail = index.history.at(-1);
  if (!tail || tail.date !== index.as_of || Math.abs(tail.close - index.last_close) > 1e-5)
    ctx.addIssue({ code:'custom', message:'Nasdaq session and closing level disagree' });
  const age = Date.now() - Date.parse(index.as_of + 'T23:59:59Z');
  if (!Number.isFinite(age) || age > 6 * 86400000 || age < -2 * 86400000)
    ctx.addIssue({ code:'custom', message:'Nasdaq close is stale or future-dated' });
});

const schema = z.object({
  status: z.enum(['available', 'degraded', 'unavailable']).optional(),
  crypto: z.array(z.object({ symbol: z.string(), name: z.string(), price: finite.positive(), change_1h: finite.nullable(), change_24h: finite.nullable(), change_7d: finite.nullable(), market_cap: finite.min(0).nullable(), volume_24h: finite.min(0).nullable(), as_of: z.string().optional() })),
  assets: z.array(asset),
  nasdaq: nasdaq.nullable().optional(),
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
  if (data.status === 'unavailable' || (!data.crypto.length && !data.assets.length && !data.nasdaq)) throw new Error('Market data is unavailable. No portfolio signal was calculated.');
  if (!data.assets.length) data.portfolio = null;
  const degraded = !data.portfolio || !data.crypto.length || !data.assets.length || !data.nasdaq || !data.status || data.source_health?.some(source => source.status !== 'available');
  return { ...data, status: degraded ? 'degraded' as const : data.status };
}
