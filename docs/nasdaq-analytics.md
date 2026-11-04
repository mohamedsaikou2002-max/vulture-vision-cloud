# Nasdaq Composite on Analytics

Vulture Vision's Analytics page now includes **Nasdaq Composite (^IXIC) daily closing levels**, using the same Yahoo Finance historical chart reader already used by the socioeconomic AutoSim system.

## What appears on Analytics

- Index level in **points** (not a USD security price)
- Latest completed session date, close-to-close index-point change, and observed percent change
- Observed 20-trading-session percent return
- Realized 20-session annualized volatility (standard deviation of 20 log returns × sqrt(252))
- Last 60 completed sessions as a dated line chart
- Source information and explicit unavailable/stale states
- Pre-existing SPY/QQQ/GLD analytics, cryptocurrency dashboard, and Nasdaq descriptive market regime remain intact

## Data lineage

`supabase/functions/vv-analytics/index.ts`
→ `supabase/functions/_shared/nasdaq_analytics.ts`
→ `supabase/functions/_shared/autosim_data.ts#loadNasdaqCandles`
→ `https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=1y` (falls back to `query2.finance.yahoo.com`).

The existing shared reader rejects malformed, insufficient, or stale daily histories. The wrapper adds calculations but no secondary quote service, intraday market clock, or simulated fallback. Yahoo may rate-limit requests or be inaccessible; this is reported as unavailable, not a made-up zero, and other Analytics sections can still work.

The dashboard's `vv-analytics` cached snapshots use a 120-second TTL. **The date on the chart is the latest completed market session, not the moment a live quote was received**.

## Deployment

1. Merge the PR after GitHub CI passes (lint, frontend TypeScript, automated tests, build, Deno checks).
2. Deploy the updated `vv-analytics` Supabase Edge Function.
3. Verify that `GET/POST vv-analytics` (authenticated) returns `nasdaq`, the source-health row, correct session date and valid closing history, or `nasdaq: null` when the public provider is inaccessible.
4. Confirm browser display and market closures. Compare the returned latest closing level with an independently checked historical Yahoo or exchange reference.
5. Verify that the index chart displays no invented intraday quote, that historical Nasdaq returns are not labeled predictive probabilities, and that missing Nasdaq does not erase the other analytics.

No new environment key, database schema, or trading capability is introduced. Yahoo's public endpoint is unofficial and has no uptime, rate-limit or commercial-use guarantee. Production provider availability was not confirmed during development.
