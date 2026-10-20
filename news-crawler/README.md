# Continuous global metadata collection

The owner requested all 207 additional candidates on top of the existing 80-source
registry. `catalog.load_sources()` enables that runtime selection; the original
research catalog is retained with its historical review flags. Collection remains
bounded, public metadata only, and robots/access restrictions still apply.

Run a one-shot sweep:

```
news-crawler/.venv/bin/python news-crawler/run_catalog.py --global-only --workers 4 --output /tmp/news-207.json
```

Add `--upload` only with server-side `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` configured. Use `live_pipeline.py` for supervised
continuous collection, with `NEWS_INCLUDE_GLOBAL=true` (default), four workers,
and a five-minute minimum-default per-source schedule. Publisher crawl delays
are enforced across threads. `NEWS_SOURCE_IDS` selects a diagnostic subset.
`NEWS_INCLUDE_GLOBAL=false` selects only the original enabled registry.

The worker publishes deduplicated articles and source heartbeat rows, and calls
the existing context worker using `NEWS_CONTEXT_WORKER_TOKEN`. Apply the additive
`news_source_status` migration through the release process. The frontend pages
through all recent collected articles, displays individual source status, polls
every minute and supports realtime inserts when enabled in Supabase. New dated
headlines also appear in the simulator and can seed a scenario without starting
a paid run.

The cloud task attempted all 207 sources: all failed public DNS resolution; zero
articles were collected and no upload was possible without server credentials.
This is a real failed sweep, not a verified operational catalog. No system can
promise all possible news; unavailable publishers remain visible as failures.
See `deployment/whisper/README.md` for the supervised service deployment.

## Original registry research and crawler behavior

The office footprint is grounded in BlackRock's corporate contacts and careers location pages, checked October 11, 2026. Their named office lists cover 40 distinct news markets when combined. Hong Kong is tracked separately, and Scotland is grouped under the United Kingdom. BlackRock reports 41 countries globally; these pages do not enumerate a matching complete 41-country set. The remaining aggregate-count discrepancy is unresolved. Product availability, distributors, custody banks and complaint-handling contacts are not treated as proof of a physical office.

`sources.json` contains 80 candidates (two publishers per market), explicit homepage URLs, language hints and office evidence. API availability has not been exhaustively assessed. The crawler works independently of APIs and discovers RSS/Atom before falling back to HTML NewsArticle JSON-LD. These are candidate sources, not 80 verified functioning feeds. `publisher-research.json` records separate web retrieval checks: 47 returned content and 33 were unverified. Those retrieval results do not establish permission, feed availability or direct crawler reachability. `source-checks.json` captures the real crawler attempt in this workspace: all 80 were blocked by outbound DNS resolution restrictions. No articles were uploaded.

## Setup

```bash
cd news-crawler
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
# Read-only bounded pilot; see robots/access errors in the output JSON.
.venv/bin/python crawler.py --sources gb-1,fr-1,au-1 --limit 5 --output crawl-result.json
# Check all publisher homepages; no article extraction/upload.
.venv/bin/python audit_sources.py
```

Use a host that can resolve and reach public publisher domains. The worker deliberately refuses unresolved or non-public addresses. Do not disable that check to work around this workspace's restrictions. Configure a descriptive user agent/contact URL before hosting externally.

## Vulture Vision wiring

1. Apply `supabase/migrations/20261012032500_news_articles.sql` to create the authenticated-read, server-write article table. Existing tables are unchanged by this migration.
2. Deploy the updated `vv-news` function. It returns `publisher_news` and `publisher_status`, validates the reading user's Supabase identity, and optionally filters by publisher country. It only selects articles fetched within 48 hours and published within 72 hours (or an unknown publication time explicitly displayed as unknown).
3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the worker's server environment, never the frontend. Run `crawler.py --sources <pilot-source-ids> --upload` after verifying a pilot result. Upserts are deduplicated by canonical-URL hash and rejected writes fail visibly without printing credentials.
4. The updated news page displays a Global publisher desk with country filtering, source, language, linked headline and known publication time. Country identifies the publisher's market; it does not assert that the article is about that country.

No migration, function deployment, upload or recurring job has been executed. Initially run small batches and verify their data before scheduling. A production host should supervise the worker, cap execution time, keep its local SQLite conditional-request cache, monitor source failures and refresh the office/source registry periodically.

## Collection behavior

- Registry allowlist only; no user-provided arbitrary destination URLs.
- Public-address DNS check, per-redirect allowlist and robots check, redirect/time/response-size limits.
- At least three seconds between requests to a publisher host; honors robots crawl-delay/request-rate values when available.
- Unavailable robots/access-denied/rate-limited pages are skipped; robots 404/410 is treated as no published directives. robots availability and rights are separate questions.
- Up to two discovered feeds or two public article pages per source; no browser automation, paywall workarounds or anti-bot bypass.
- Extracts public titles, URLs and timestamps, not article bodies. Feed/index pages and robots may be cached for conditional requests; fetched article bodies are not retained.
- Dates without a timezone remain unknown; retrieval time is recorded separately.
- Original language is retained as a registry hint; translation and automatic language detection are not yet implemented. Multilingual crawler titles are not fed into the existing English-only sentiment heuristic.
- Sources requiring licensed content, API contracts or other access are recorded/skipped rather than bypassed. Newsletter redistribution and article-body rights require publisher-specific review; no full-text rights are assumed.

## Remaining work

Live ingestion is unverified due to workspace DNS restrictions. Many outlets are paywalled or JS-rendered, and metadata extraction intentionally yields no items when there is no supported public format. Add publisher-specific feed URLs/selectors after checking each actual publisher. Full-text extraction, translated summaries, cross-publisher syndication clustering, geographic story tagging, retention cleanup and newsletter sending are not implemented. Robots parser uses Python's standard RobotFileParser; evaluate edge cases with publisher policies during live onboarding. DNS checks assume trusted registry publishers; use a controlled egress proxy in production if stronger anti-rebinding guarantees are required.
