# Yahoo Nasdaq data for socioeconomic observations

The authenticated `vv-autosim` world-state action fetches the public, keyless
Yahoo Finance REST chart endpoint for Nasdaq Composite (`^IXIC`):

`https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=1y`

It fails over to the equivalent `query2.finance.yahoo.com` endpoint. The backend
validates completed daily observations and supplies the socioeconomic page with:

- Nasdaq closing level, in index points;
- observed daily close-to-close return;
- observed 20-trading-session return;
- realized annualized volatility and the original observation dates.

The page polls every minute, offers manual refresh, and distinguishes unavailable
data from zero. Daily observations are not intraday quotes. FRED economic metrics
remain independently sourced. No API key or paid market subscription is needed
for this endpoint; Yahoo's public chart service is unofficial and has no uptime
or rate-limit guarantee.

Deploy the changed `vv-autosim` function and sync the frontend. No new secret or
schema migration is required for this addition. Both Yahoo hosts returned 429 in
the live task check; successful live reads remain unverified until that provider
limit clears. Do not bypass throttling or present cached/model data as live quotes.
