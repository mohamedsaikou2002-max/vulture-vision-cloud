> Updated: the default workflow now prepares prompts automatically before user input. See [automatic-news-prompts.md](automatic-news-prompts.md). The optional vv-scenario-brief endpoint remains available for explicit requests; its button is no longer required in the UI.

# Current-event, objective-driven simulations

## User workflow

1. Browse Global Publisher Desk headlines and use **Plug into simulation**, or ask Gemini for scenario suggestions on the news page.
2. In Simulations, choose **Current events** and enter an objective, optional capital, currency, horizon, risk tolerance, exposures, constraints and alternatives.
3. Select **Synthesize current global events**. The server loads timestamped, ingested news from the last 24 hours; selected story IDs are checked against the database. It does not accept user-written headlines as trusted source evidence.
4. Gemini returns a summary, source-linked drivers, suggested scenarios, candidate decisions, evaluation metrics and explicit assumptions. Review the evidence and choose/edit a suggested scenario.
5. Start MiroFish. The seed and simulation requirement contain the frozen news, user context and comparison criteria. Generate the report after completion to compare options under base/adverse/favorable conditions.

News-generated suggestions are scenario inputs, not installed third-party software plugins. They never auto-run a simulation or execute a trade.

## Evidence and freshness

This is a current-news snapshot, not a continuous live price feed. Sources must have both publication and retrieval timestamps within 24 hours. Unknown publication times are excluded from current-event synthesis, even if those headlines appear in the broader news desk. The API returns actual articles and markets represented; it does not claim all registered markets have data. Selection is breadth-first, up to two articles per market plus explicitly selected recent articles, capped at 80 headlines. The first 1,000 most recent database records are considered. Very active markets can still crowd out lower-volume markets before that cap; per-country database sampling is a future scale improvement.

Snapshots expire after 15 minutes and are invalidated when user decision inputs change. Existing runs retain their original seed; refresh and start another run to incorporate newer events. The news page loads feeds every five minutes, but that does not schedule the ingestion worker or make provider data real time. Deploy and run ingestion on the backend to supply fresh records.

Citation validation confirms generated IDs exist in the supplied snapshot; it does not prove that every model interpretation follows from a headline. Users can inspect linked sources. No unverified historical magnitude, made-up holdings, market prices, expected returns or calibrated outcome probabilities are supplied. Capital and horizon are decision context; no portfolio valuation, trade execution or guaranteed optimization is implemented. MiroFish models social-agent interactions; portfolio numeric risk estimation needs dedicated market data and quantitative models.

## Server setup

Apply the pending news_articles migration first, then `20261012034000_scenario_synthesis_quota.sql`. It creates an atomic, service-only six-requests-per-user-per-hour budget gate. Failed provider calls consume quota; no quota bypass is allowed when the database function is unavailable. Configure MIROFISH_ALLOWED_USER_IDS for the operator pilot. Existing audited endpoints still need their own hardening.

Deploy `vv-scenario-brief`, the updated `vv-news`, and the existing `vv-simulation` gateway. The new function reuses **GEMINI_API_KEY**, already used by vv-chat. It never returns the key. Optionally set GEMINI_SCENARIO_MODEL (default gemini-2.5-flash) to a supported model. No Gemini call was made during development; provider compatibility must be smoke-tested after configuration.

MiroFish can use the same Gemini key for agents/reports. Apply `deployment/mirofish/gemini-provider.patch` to the pinned upstream checkout in addition to gateway.patch. On that backend host set:

```dotenv
GEMINI_API_KEY=<same key configured securely in Supabase>
ZEP_API_KEY=<Zep key>
VULTURE_GATEWAY_REQUIRED=true
MIROFISH_GATEWAY_TOKEN=<gateway token>
```

Remove placeholder LLM_API_KEY/LLM_BASE_URL/LLM_MODEL_NAME and LLM_BOOST_* values from the copied upstream .env when using automatic Gemini configuration. The patch selects Google's OpenAI-compatible endpoint and gemini-2.5-flash when GEMINI_API_KEY is present and LLM_API_KEY is absent. Explicit LLM_* settings still take precedence. The key must be configured securely on both hosts; the Supabase secret is not copied or exposed by this feature.

Official compatibility reference: https://ai.google.dev/gemini-api/docs/openai . Google's compatibility layer is not a complete implementation of every OpenAI feature. The provider-configuration smoke test passed locally with a dummy key; end-to-end OASIS/provider tests still require real credentials. Zep remains a separate required service.

## Validation and deployment state

Typecheck/build and seven frontend/domain tests pass, including snapshot expiration, invalid user inputs, source-reference rejection and source/context preservation in seeds. Changed frontend/new shared/Edge Function files pass ESLint. Crawler's seven Python tests previously passed. No production migration, function deployment, provider call, paid simulation, merge or Lovable update was performed. Full authenticated browser testing remains pending.
