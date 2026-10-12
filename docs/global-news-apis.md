# Global news API shortlist for Vulture Vision

Checked October 11, 2026. These are ingestion candidates, not configured integrations. Start with a broad discovery source plus one event-clustering service; add regional publisher feeds to fill coverage gaps. Build newsletters as original summaries with source links and timestamps. API access alone does not establish rights to redistribute full articles; check each contract for newsletter, storage and AI processing permissions.

| Provider | Role in Vulture Vision | Official documentation | Integration note |
|---|---|---|---|
| GDELT DOC 2.0 | Global geopolitical discovery across translated news | https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ | Keyword discovery across 65 supported machine-translated languages; retain original URLs/languages and separate source count from independent corroboration. |
| GNews | Country/language filtered headlines and search | https://docs.gnews.io/ | Useful general feed; search and headline endpoints accept different country/language sets. |
| World News API | Broad multilingual regional search | https://worldnewsapi.com/docs/search-news/ | Documentation reports 86+ languages and 210+ countries. Validate relevance and lag for each selected market. |
| NewsData.io | Region/language/category-specific news channels | https://newsdata.io/documentation | Latest endpoint supports country, language and category filters. Configure server-side key and pagination. |
| Event Registry / NewsAPI.ai | Group related articles into events, entities and locations | https://newsapi.ai/documentation?tab=searchEvents | Helps reduce repeated syndicated stories before generating briefs. Event date can differ from article publication date. |
| ReliefWeb | Humanitarian crises, disaster/conflict reports | https://apidoc.reliefweb.int/ | Curated OCHA data archive in JSON; complements financial news with humanitarian context. Follow current app-name/access guidance in documentation. |
| Guardian Open Platform | Publisher-level world/business coverage | https://open-platform.theguardian.com/documentation/ | API key required; commercial enterprises should use commercial access: https://open-platform.theguardian.com/access/ . |
| NewsAPI.org | General headline/search feed | https://newsapi.org/docs | Already referenced by vv-news. Developer plan is development/testing only, not staging or production: https://newsapi.org/terms . |

## Recommended order

1. GDELT for discovery plus the existing curated RSS sources.
2. GNews or World News API for structured country/language feeds; choose after sampling target regions.
3. Event Registry for event clustering and entity-aware intelligence.
4. ReliefWeb for crisis context.
5. Licensed publisher feeds where direct provenance matters.

## Feed groups

- Americas: English, Spanish and Portuguese; source-country filters distinct from story-country tags.
- Europe: English, French, German and local-language feeds.
- Middle East / North Africa: Arabic, French and English.
- Sub-Saharan Africa: local sources plus English/French/Portuguese; sample actual provider coverage rather than assuming language equals region.
- South Asia: Hindi, Urdu, Bengali and English where supported.
- East/Southeast Asia: Chinese, Japanese, Korean, Indonesian and other supported languages.

## Normalized ingestion record

Store provider, source name/domain, canonical URL, headline, permitted excerpt, original language, published_at, fetched_at, source_country, story locations, entities, topics, license/retention policy and deduplication hash. Translate with the original preserved. Cluster syndication and count independent sources separately. Treat ingested text as data, not instructions. Expose stale and provider-failure states.

A newsletter pipeline should ingest centrally on a schedule, cache once for all users, deduplicate, cluster, generate source-backed summaries and show an editorial preview. Sending newsletters requires a recipient/subscription flow and explicit send authorization; none were sent or scheduled.
