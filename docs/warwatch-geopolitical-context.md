# WarWatch.World geopolitical context in Vulture Vision

Upstream: https://github.com/nitinchhabria89/WarWatch.World (MIT-licensed code).
This integration calls the documented public `GET https://warwatch.world/api/conflicts` endpoint; it does **not** copy or embed the upstream app, scrape publisher article text, or claim access to the unrelated war-watch.com service.

## Design

- `supabase/functions/_shared/warwatch.ts` fetches a fixed HTTPS URL using bounded time, payload size, event count, and input shapes. Outbound redirects are rejected.
- Conflict records are **secondary data**, not independent news articles. WarWatch event records currently lack canonical original publisher URLs and often use a *date* rather than a publication timestamp.
- The adapter preserves country, conflict, event date, reported description, upstream attribution, and interpretable **hypothesized** transmission channels: energy supply, transport/logistics, sanctions/trade finance, migration/labor, policy uncertainty, regional security.
- It only forwards event dates within the previous three calendar days to active simulation context. This is a date-only window, **not evidence of live or independently verified breaking news**. Empty/stale/unavailable endpoints contribute no simulation events.
- It never inserts aggregated events into the `news_articles` table, never increases independent publisher/citation counts, and never supplies a quantitative market shock or calibrated prediction.
- The `vv-news` Edge Function returns the field `warwatch` alongside the existing feeds; the News page shows a distinct attributed conflict panel and source status.
- The `vv-news-context` background worker includes the same secondary context in the Gemini synthesis request and persists an optional `geopolitical_signals` field in the JSON news-context snapshot.
- `vv-scenario-brief` does the same for explicit operator synthesis requests.
- `buildCurrentSeed` freezes geopolitical context into the MiroFish seed and scenario requirement. `Simulations.tsx` gives the bull/bear/macro/risk analyst panel bounded, clearly labeled secondary conflict annotations and a source link within its saved context.

## Configure and deploy

1. Deploy the updated Edge Functions `vv-news`, `vv-news-context`, and `vv-scenario-brief` through the existing Vulture Vision deployment process.
2. `WARWATCH_ENABLED` defaults to enabled; explicitly set `WARWATCH_ENABLED=false` on the relevant Edge Functions to disable external calls.
3. Verify the public API responds in your deployment environment. The upstream service was **not reachable for live verification in this development session**. It may return seeded/stale records, have outages, or change its schema.
4. Ensure the existing `news_articles` worker, `claim_news_context` and `finish_news_context` RPCs, and Gemini configuration are healthy; this change does not supply any replacement publisher news.
5. Run `npm test -- --run src/test/warwatch.test.ts` and the existing news/context/simulation tests. Verify the runtime response `warwatch.status`, panel, and frozen seed in a staging environment.
6. For MiroFish, continue to configure and run the separate authenticated engine and approved user access, as required by `docs/current-event-simulations.md`.

## Interpretation and limitations

This adds *context*, not proven forecasting accuracy. Backtest hypotheses against held-out events, compare forecasts with/without WarWatch context, review source accuracy across geographies, and score whether the extra context reduces errors before any accuracy claim.

No source without independently verifiable reporting should be promoted into a high-confidence evidence class. There is no automatic trading, military targeting, or active RF functionality in this integration.
