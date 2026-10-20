# World-state integration and audit fixes

The simulator adapts Belicia's shock/mood/headline presentation from
`mohamedsaikou2002-max/belicia` at `c8928f5d4a4db5b04dc1c65a8332f288dd95ff31`.
Belicia generates these fields using an AI prompt. Vulture instead derives an
illustrative market snapshot from dated economic observations and indexed news.
It does not measure people's psychology or verify geopolitical events. Missing
and stale observations are labelled; the model remains uncalibrated.

AI functions accept a server-side `GEMINI_API_KEY` or `LOVABLE_API_KEY`.
The Lovable gateway defaults to `google/gemini-2.5-flash`; optionally set
`LOVABLE_AI_MODEL`. Keep provider and service-role keys in server secret storage,
never frontend environment variables. World-state retrieval does not call AI.
Existing FRED/Coinbase and publisher-news configuration supplies observations.

Controlled variants freeze the parent's evidence, observations, historical
candles, path counts, seed and execution costs. Replayed job IDs cannot trigger
another paid run. Malformed AI explanations cannot replace numerical results.

## Release checks

Run `npm ci`, `npm test`, `npm run lint`, `npm run build`,
`npx tsc --noEmit -p tsconfig.app.json`, the crawler's Python unittest suite,
and `npm run test:migrations`. The migration check uses a disposable local
Postgres-compatible database; it does not apply hosted schema changes.

GitHub/Lovable frontend synchronization does not deploy Supabase functions.
Deploy the changed functions through the project's existing release process,
including `vv-autosim`, `vv-chat`, `vv-simulation-chat`, `vv-news`, and
`vv-analytics`, with the required server secrets and accepted AutoSim schema.
Respect the existing operator permissions. Keep staged billing migrations and
checkout activation subject to project conventions.

At audit time the hosted AutoSim endpoint returned 404; provider DNS/access
failures and unavailable local research backends also remained deployment or
infrastructure issues. The crawler now reports failed/skipped runs accurately.
A passing mocked integration test does not establish hosted provider availability.
