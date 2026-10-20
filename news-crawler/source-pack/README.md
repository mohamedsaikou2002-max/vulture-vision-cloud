# Vulture Vision — Global blog and publisher crawler candidates

This is an **additional-source candidate pack**, not a record of approved commercial crawling rights.

- `global_blog_candidates.json`: 207 additional source candidates in 116 country/market codes. Every candidate is disabled by default.
- `ALL_GLOBAL_SOURCE_LINKS.md`: the complete, clickable country-sorted website list.
- `audit_crawlability.py`: read-only technical validation of robots, homepage HTTP status and RSS/Atom feeds, to run from the eventual crawler host.
- `merge_approved_sources.py`: merges only explicitly approved IDs into a *new* copy of Vulture Vision's `news-crawler/sources.json`, never overwrites the existing registry by default.

## Why these are *candidates*, not 207 crawlable sites

Vulture Vision's repository `news-crawler/sources.json` contained 80 potential sources over 40 country/market codes on inspection; this pack separately adds 207 entries across 116 markets. Neither number verifies that sources are operational, that a country's BlackRock office is present, or that their websites authorize collection for commercial AI products. A homepage loading in a browser is not a license to crawl, copy articles, generate AI summaries from the text, or redistribute content.

The research environment used to assemble this pack had no outbound DNS from Python. Some sources were checked using webpage/robots tools instead. **There was no full 207-site live technical or terms audit.** The scripts are supplied so your production machine can do a real network audit.

## Setup / testing in Cursor

```bash
python -m pip install requests beautifulsoup4
cd VultureVision_Global_Blog_Crawler_Pack
python audit_crawlability.py --limit 10 --workers 2
python audit_crawlability.py --workers 3
```

Technical findings will be written to `crawl_audit_results.json`. This can take time and a subset may be unreachable from your jurisdiction or host. Don't spoof web browsers or rotate proxies to overcome blocks. Robots may change, so recheck at the required frequency. The script is read-only, rate-limited per site to at most a few checks, and has a conservative bound on response sizes. Production ingestion must implement its own domain-specific crawl delays and content policy.

Review each site's `robots.txt`, actual feed, terms of use, licensing and permitted AI-analysis/redistribution scope manually. The `technical_candidate_pending_terms_review` label *does not mean permission to crawl commercially.* RSS feeds may have separate licenses even if they are publicly readable.

For reviewed and accepted sources, create an approval file:

```json
{"approved_ids":["global-extra-001"]}
```

Then copy the reviewed results and run (adjust paths):

```bash
python merge_approved_sources.py \
  --existing ../vulture-vision-cloud/news-crawler/sources.json \
  --approval approval.json \
  --audit crawl_audit_results.json \
  --output sources.expanded.review.json
```

Review the generated JSON and update the app's registry only after source-by-source checks.

## Sample reviews established from public documentation

- **Cloudflare Blog**: published robots allows general `/` crawling outside identified excluded paths and includes explicit Content-Signal values at the time reviewed. Its `/rss/` resource is served with RSS MIME type in web testing. Still evaluate intended commercial reuse/licensing.
- **Tech in Asia**: published robots disallows several paths including `*/feed`, and has specific restrictions for some AI crawlers. Do not force-discover blocked feed paths.
- **Bank for International Settlements**: has an official RSS directory and a robots file with path-specific restrictions, including internal/system directories.
- **World Bank Blogs**: published robots generally permits content paths while restricting administrative and special paths.
- **Coinbase Blog**: blog sitemap is advertised in robots; OAuth, trading and account paths are restricted.
- **The Bell (Russia)**: publishes business/economy research, but some content is paywalled. Do not attempt to bypass access controls.
- **Business Post (Ireland)**: returned a robots denial for the browsing agent used for the sample fetch. Treat as restricted/terms-review, not unrestricted.
- **Reuters**: robots notice explicitly prohibits automated content collection absent prior written consent. Do NOT add Reuters via this pack or scrape without a contract.

## Data integrity rules for Vulture Vision

Store source, canonical URL, first_seen_at, source_published_at and license/provenance. Deduplicate syndicated events. Send only permitted article metadata and derived internal event tags to Gemini. Do not present news/sentiment as measured asset-price outcomes. Global blogs support the scenario simulator's slow evidence lane; they are not low-latency trading feeds. Never treat article count as independent signal count.
