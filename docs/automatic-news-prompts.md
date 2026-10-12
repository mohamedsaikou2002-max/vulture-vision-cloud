# Automatically maintained simulation context

New/changed news → durable queue → Gemini background prompt → immutable version → Realtime simulator/news UI → user scenario and decision inputs → frozen MiroFish seed.

The background prompt is generated before any user input. Users do not have to press a synthesis button. The news page automatically displays suggestions from the same latest version. Current-events launches combine its prepared prompt with the user's objective, capital, exposures, constraints and question. Already-running simulations retain their original context version; later headlines prepare the next run.

## Trigger and worker

The `news_articles` database trigger increments a durable singleton queue revision on inserts/deletes or changes to title, publication date, publisher country, language, URL or source. Fetch-timestamp-only updates are ignored. The worker uploads each publisher batch immediately, rather than waiting for a complete global crawl sweep.

`live_pipeline.py` runs ingestion and a background refresh thread. The thread checks `vv-news-context` every two seconds. A database lease serializes generation; updates arriving while Gemini is running remain pending after the older version completes. Completed prompts are stored in news_prompt_versions, readable by signed-in users but writable only by the service role. Supabase Realtime delivers inserts to the UI, with a 15-second read fallback.

Latency starts when a source is ingested. A publisher's publication time can precede detection. Polling crawl sources, provider response time and queue budgets prevent a promise of literal zero-latency breaking-news coverage. A licensed webhook/event feed can write the same news_articles table to trigger this path as soon as an event arrives.

Background generation is limited to one claim per 30 seconds and 60 attempts per clock hour. Failed calls consume attempts. The last good prompt is retained on failure. Versions expire after 15 minutes; the worker can refresh expired context even without a new article. Stale contexts disable current-event launches. No new prompt is synthesized from undated/older-than-24-hour news. Source coverage is the actual bounded evidence set, not all registered publishers/countries.

## Deployment

Apply the existing news_articles migration, then `20261012040000_live_news_context.sql`. It creates version storage, queue, budget, material-change trigger and service-only RPCs, and adds prompt versions to Supabase Realtime where that publication exists.

Configure these secrets securely on the Supabase project:

- GEMINI_API_KEY: existing Gemini key (never sent to browsers).
- NEWS_CONTEXT_WORKER_TOKEN: a random worker-only secret.
- GEMINI_SCENARIO_MODEL: optional supported Gemini model (default gemini-2.5-flash).

Deploy `vv-news-context` plus the existing pending simulation/news functions. On the worker host set:

```dotenv
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only credential>
NEWS_CONTEXT_WORKER_TOKEN=<same worker-only secret>
NEWS_SOURCE_IDS=gb-1,fr-1,au-1
NEWS_CRAWL_INTERVAL_SECONDS=60
```

Start a bounded pilot, then expand sources verified on that host:

```bash
cd news-crawler
.venv/bin/python live_pipeline.py
```

The source filter is optional; omit it to scan the full registry. Actual sweep duration grows with source count, page count and publisher crawl-delay. Supervise the process and monitor JSON status logs. Keep SQLite cache on persistent storage. The worker's gateway-token and Supabase service credentials are server-only; ordinary users cannot trigger background paid calls directly. Individual optional vv-scenario-brief requests remain separately quota-limited.

Retention: prompt versions contain bounded public metadata and generic background inputs, not user capital-management details. Configure a retention policy for old versions and hourly budget rows before long-running production operation. DNS restrictions prevented live publisher ingestion in the development workspace; use a network-capable backend. MiroFish hosting/Gemini compatibility and Zep setup remain as documented in deployment/mirofish/README.md.

## Validation

10 Vitest tests, frontend typecheck/build, changed-file lint and seven crawler tests pass. A real PostgreSQL-compatible PGlite run applied the news, quota and live-context migrations and checked duplicate suppression, leases, updates during generation, failure retention and read/write/RPC permissions. No real Gemini request or live crawler upload was made during development. Production deployment and continuously running worker are separate from merging the code.

This supersedes the earlier on-demand-only workflow in current-event-simulations.md. Headlines prepare generic world context continuously; user inputs personalize the cached context locally without another Gemini call. The news evidence is frozen into each launched engine seed.
