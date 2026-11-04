# OSIRIS news-only source integration

Upstream open-source OSIRIS: https://github.com/simplifaisoul/osiris (MIT license, `master` branch).
This integration deliberately imports **only publisher news sources and external news-broadcaster links**. No OSIRIS flight routes, ADS-B/OpenSky feeds, aircraft or ships, CCTV, maps, weather, satellite, seismic/disaster, crypto wallet, scanning or other OSINT endpoints are connected.

## What is connected

1. **40 additional publisher RSS/Atom subscriptions** reviewed from OSIRIS's `src/lib/oi/newsroom.ts` and the conventional publisher portion of `src/app/api/news/route.ts`. These include world, political, economic, financial, technology, energy, defense, health, science, climate and sports news outlets, spanning several publishing countries. Duplicate feed URLs already in Vulture Vision were excluded.
2. **15 news broadcaster links** reviewed from `src/app/api/live-news/route.ts`. These are external links to original broadcasters, not embedded live video or article data.
3. **News dashboard attribution**: stories from the added publisher catalog show the original publisher source and a secondary `OSIRIS news pack` discovery marker; a source-count indicator reports configured subscriptions, not verified availability.
4. **Existing Vulture Vision ingestion and swarm**: the 40 new publisher feeds join `sourceCatalog`. `catalog_ingestion.ts` rotates through approved sources in bounded batches, respects robots rules and allowed hosts, validates publication date and original publisher URLs, upserts only headline metadata into `news_articles`, and retains a content-addressed ID by publisher canonical link. Those same articles feed `vv-news` and the timestamp-limited `vv-news-context` synthesis worker used by MiroFish simulation seeds and the synthetic analyst roundtable.

## Source ownership and verification

OSIRIS is **credited as source discovery**, not a second independent news outlet. The source label and canonical URL remain those of the original publisher. Adding a publisher feed does not assert current availability, a successful fetch, truth of headlines, completeness of coverage, independence of reporting, or improved simulation accuracy.

Article data are untrusted external reporting. The simulation system already requires timestamped news and IDs when creating summaries; contradictions remain possible. Publisher domicile in `source_country` is not the place the article is about. `ZZ` means unknown or international for outlets without a reliably fixed domicile.

### Explicit exclusions

- OSIRIS Telegram/channel/social-media incident reports: **not ingested** because they can be unverified, partisan or forwarded. No fabricated original-article attribution or double counting.
- OSIRIS flight, ADS-B, aircraft, maritime, CCTV, satellite, earthquake, fire, and weather modules: **not imported**.
- GDELT machine-coded events and GDACS disaster alerts: **not imported** into the publisher news table; neither is an original publisher article.
- Live news broadcasters: included **only as outbound links**. They are not scraped, transcribed, ingested as articles or used in simulation evidence.
- No OSIRIS Next.js app, third-party scanner, background polling service, or new data permissions.

## Deployment and validation

1. After CI passes, merge and deploy updated Supabase Edge Function `vv-news`. The publisher catalog is compiled into this function, so a backend deploy is necessary.
2. Verify that `vv-news` response includes `osiris_news_sources_total: 40` and `catalog_total: 327` on a fresh news snapshot, and that any newly ingested publisher rows carry `source_id: osiris-news-###` with a valid URL and publication time.
3. The existing catalog uses bounded round-robin collection at 16 publishers per attempt, so new subscriptions are not all contacted on the first request. The app's existing source-health indicators distinguish waiting, unavailable, empty, and available feeds.
4. Confirm verified article rows, not broadcast links, appear in `news_articles` and can be selected by the existing timestamped `vv-news-context`/scenario simulation pipeline.
5. Run `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`, migration checks and Deno checks. Exercise actual publisher RSS reads in staging to determine reachability, robots restrictions, redirect behavior and copyright/commercial syndication terms.
6. Source enumeration and technical integration alone do not prove enhanced socioeconomic forecast accuracy. Backtest new sources for marginal information, duplication, contradictions and prediction quality on held-out cases.

This integration adds no paid API key, database migration, flight source or trading capability. News feeds and broadcaster URLs may change upstream.
