# Production audit and release repair — 20 October 2026

**Launch assessment: NO-GO until the hosted blockers below pass.** Repository changes do not deploy Edge Functions, apply SQL, enable Stripe, or publish Lovable. The previous hosted billing and new regime endpoints returned 404 during this audit. Supabase Auth responded 200; unauthenticated Intel chat returned 401. The supplied Lovable preview could not be reached from this workspace. These checks establish connectivity and deployment gaps, not successful paid AI inference.

## Defects and changes

| Severity | Root cause / location | Before → after | Verification |
|---|---|---|---|
| Critical | `src/components/AuthGate.tsx` authenticated session alone; optional server gates | Google session opened workspace → membership experience calls server-owned access status, rejects unavailable verification, rechecks on focus; Get Membership is the primary entry action | Browser flows, explicit backend denial tests, staged SQL checks; hosted paid flow pending |
| Critical | `_shared/access.ts`, `_shared/membership_access.ts`, `vv-autosim/index.ts`; news/market/search lacked common gate | Unpaid callers could fetch premium reads → one database release policy authorizes every customer handler, including AutoSim world state; no environment subscription-bypass flag remains | Unpaid direct requests produce 402 before providers; missing entitlement schema produces 503 |
| Critical | Direct database reads remained authenticated-only | Staged `drizzle/migrations/0003_workspace_security.sql` restricts news, source status, context and own simulation history with RLS; account billing status remains accessible | Disposable PostgreSQL: own-account isolation, unpaid reads denied, client entitlement writes/RPCs denied |
| High | `services/voice/app.py` checked session only | Transcription now requires server-confirmed workspace access before audio inference | Voice unpaid-session and audio boundary tests |
| High | `src/lib/intelApi.ts` returned null without `VITE_INTEL_HOST` | Customer Intel uses authenticated Supabase exclusively; new `vv-regime` derives a transparent Nasdaq trend/volatility heuristic from real closes, with no predictive transition probabilities | Rising-series, insufficient-history and stale-series tests; hosted function deployment pending |
| High | Foreign headlines were copied into English UI | Original and translated titles stored separately; durable translation queue, content-hash cache, leased claims, max five attempts, exponential retry and two bounded batches per invocation; originals remain visible on failure | Nine language/mixed-script hint cases, provider-output schema tests, queue/lease/reset SQL tests; real translation quality pending |
| High | `vv-scenario-brief` and `vv-news-context` bypassed configured gateway adapter | Both now use common provider/model handling; every configured adapter requests English output and preserves source references | Edge typechecks and shared AI tests; real hosted model access pending |
| Medium | `/simulations/pilot` exposed operator-only controls to customers | Redirects to `/research`, a bounded Gemini-backed analyst panel with conversation context, quota, loading/errors and no pilot controls; supplied evidence IDs resolve from server-owned recent articles | Browser route/response/mobile flows; source-ID validation remains enforced server-side |
| Medium | Quick Sim retained a previous result after a new run and ambiguous service failures could encourage fresh IDs | Clears old output for a new run; uncertain 5xx/network/invalid responses preserve a pending ID; keyboard form submission and length constraints | Shared engine integration/replay tests, Quick Sim lost-response recovery and browser submission |
| Medium | Shared analytics/news collection repeated for every reader | Authorization precedes shared expiring server snapshots (120s analytics/regime; 45s news); stale/missing observations remain explicit | Handler regressions and browser data states; cache-expiry bursts still need measured capacity work |
| Medium | Information page used unverifiable customer claims and long prose | Premium black/gold showcase, five factual capability counts, exactly three real app captures, keyboard-accessible image expansion, reduced-motion statistics, demo placeholder and membership copy | Browser at 390/768/1440; captures explicitly label illustrative test data |
| High | Older dependency lock contained published advisories | Toolchain/router and compatible transitive dependencies refreshed; see final dependency results below | Clean install, advisory scan and full regression suite |

Locations above are relative to `supabase/functions/` unless a fuller path is shown. Operator-only gateway functions retain their separate allowlist. Background workers retain separate server tokens. Retired MiroFish customer components are no longer routed; backend gateway code is retained for operators, rather than decommissioned without dependency review.

## Membership release boundary

The supplied requirements explicitly prohibit activating a production paywall until staging payment tests pass. The new policy is **staged with `paid_access_required=false`**, preserving the existing release while enabling a single reviewed database activation. This is a release control, not a customer-editable environment bypass. Clients cannot read or change the policy table. If its RPC/schema is missing, the new server handlers fail closed.

Once activated, qualifying membership must have a server-written active/trialing subscription, valid period, Stripe customer ownership mapping, Stripe subscription/price identifiers and processed event provenance. Trialing is only written after the signed webhook confirms the $99 introductory invoice is paid. Editable user metadata and checkout success URLs never confer access. Billing status, authentication, public pages, checkout and the Customer Portal remain outside the premium boundary. Direct simulation history remains own-user-only even for paying members.

## Required deployment order

1. Back up the staging schema. Apply existing Supabase migrations, including `20261021010000_headline_translation.sql`. Apply staged `0001_autosim.sql`, `0002_billing.sql`, then `0003_workspace_security.sql` through the approved migration path. Do not apply staged SQL twice or run both migration systems against the same additions.
2. Configure the existing Stripe test-mode prices and server bindings in [FINALIZATION.md](FINALIZATION.md). Keep `BILLING_ENABLED=false` until offer/price validation and webhooks are deployed. Never put provider, service-role or Stripe secrets in `VITE_*` variables.
3. Deploy all modified Edge Functions, including `vv-billing`, `stripe-webhook`, `vv-regime`, `vv-news-translate` and the shared-adapter consumers. Deploy schema before the new UI gate: missing billing status correctly denies access. The webhook alone uses `verify_jwt=false` and verifies the raw Stripe signature. Worker calls require the normal gateway authorization plus their private worker header.
4. Enable email-link authentication and delivery in Supabase; configure redirect allowlists for the real Lovable/custom domains. The visible Get Membership email flow uses authenticated account activation; Google remains an alternative. Configure anti-abuse limits/CAPTCHA as supported by the hosted auth settings and verify account recovery/email delivery.
5. Configure `NEWS_TRANSLATION_WORKER_TOKEN` and a comma-separated `TRANSLATION_SOURCE_IDS` containing only publisher IDs whose metadata usage permits translation. No list means no translation provider calls. Schedule one `POST /functions/v1/vv-news-translate` worker per minute with `x-news-translation-token` and server authorization. The worker claims at most 20 headlines, makes at most two provider batches, and leases work for three minutes. Monitor failed/retrying/rights-not-approved statuses; do not retry denied rights automatically. After rights approval, explicitly requeue the affected publisher rows in a reviewed service operation.
6. Configure `VITE_DEMO_YOUTUBE_URL` with a normal YouTube watch URL or youtu.be URL. Missing/invalid URL shows a branded placeholder, never a broken embed. Screenshots under `public/images/` contain application test captures, not customer information.
7. Deploy the private voice gateway update if voice is enabled; keep Whisper on loopback behind authentication, HTTPS, origin restrictions and ingress rate limits. A missing model is still a launch limitation for voice; typed input remains supported.
8. Run Stripe test-mode checkout, $99 payment, seven-day introduction, monthly renewal, failed payment, cancellation, expired session, portal ownership, duplicate/out-of-order webhook and cross-account read tests. Verify the actual hosted `workspace_access` status and API 401/402/403/429/5xx states. See the exact checklist in FINALIZATION.md.
9. In staging only, set `workspace_release_policy.paid_access_required=true`; confirm unpaid users cannot read the REST tables, call premium functions or open deep links. Confirm paid users can use every feature and billing remains accessible after cancellation. Record test acceptance before repeating the policy activation in production. Remove the obsolete `VV_REQUIRE_SUBSCRIPTION` secret; no new runtime code reads it.
10. Push GitHub main to trigger the configured Lovable sync. Verify the synchronized commit, deploy Functions/migrations separately in the connected Supabase/Lovable environment, then perform a hosted smoke test before explicitly publishing. A GitHub push is not proof of Lovable deployment or publication.

## AI/API wiring inventory

| Customer feature | Backend | Provider/configuration |
|---|---|---|
| Intel chatbot | `vv-chat` | Shared Gemini/Lovable adapter; authenticated, paid-policy checked, shared research quota |
| News synthesis | `vv-intel-brief` | Same adapter; bounded recent publisher and RSS metadata |
| Financial analytics narrative | `vv-analytics` | Same adapter; shared 120s snapshot; CoinGecko with Yahoo crypto quote fallback, Yahoo/Stooq equity history; optional Etherscan gas |
| Pod Room / Quick Sim interpretation and explanation | `vv-autosim` | Same adapter; deterministic Nasdaq engine; explicit missing-data and AI-failure warnings, atomic quota/job claim |
| Cohort / Research Chat | `vv-autosim` interrogation / `vv-simulation-chat` | Same adapter, existing shared research quota; source IDs validated |
| Scenario briefing / background context | `vv-scenario-brief` / `vv-news-context` | Same adapter; optional `GEMINI_SCENARIO_MODEL`; operator/worker permissions retained |
| English headline translation | `vv-news-translate` | Same adapter; approved-source metadata only, durable queue and hash cache |
| Economic observations | AutoSim data adapter | Yahoo Nasdaq `^IXIC`; FRED keyed API or public CSV fallback; real timestamps and missing dimensions |
| Market regime | `vv-regime` | Nasdaq daily closes; descriptive versioned rule, no AI or calibrated transition forecasts |
| News registry | `vv-news`, catalog collector, Python crawler | 287 registered candidates, bounded rotating collection with robots/access/source health; registration is not verified active coverage |
| Voice | Private FastAPI + whisper.cpp | Supabase session and workspace status verified before local model inference |

Server credentials: `GEMINI_API_KEY`, numbered `_1` through `_20` (deduplicated), optional `GEMINI_MODEL`; or `LOVABLE_API_KEY` and `LOVABLE_AI_MODEL`. Native Gemini slots rotate **only on HTTP 429**, honor per-model Retry-After within warm workers, and share a total deadline. New candidate models are tried only on 404; the legacy configured defaults are retained, with `gemini-2.5-flash` added as a recognized fallback. Actual model existence, project access, billing and quotas must be tested in the deployed project. Multiple keys do not increase a provider's project quota. No alternate paid inference is attempted after an ambiguous failure.

No private hosted credentials were available in this workspace. The tracked `.env` contains public Supabase project/publishable configuration, not service credentials. A pattern scan found no provider/Stripe/private-key secrets in tracked working-tree files. This is not a complete historical or external credential inventory and does not prove previously exposed keys were rotated.

## Capacity and cost assessment

50,000 monthly active users is a planning target, not measured capacity. No authenticated staging identities, deployment management credentials, infrastructure telemetry or approved isolated load target were available. **Hosted load results at 100/1,000/5,000 concurrent users are not measured**; p50/p95/p99, RPS, DB utilization and queue latency therefore have no defensible values yet.

A staging k6 harness is provided at `scripts/load/workspace.js`. Supply one distinct paid test identity per virtual user, an authorized isolated target and provider budgets. Run separate 100, 1,000 and 5,000 VU cases, export k6 JSON, and correlate with Supabase CPU/IO/connections/slow queries, Edge concurrency and provider 429 metrics. The harness tests cached news/regime reads; separately test realistic authenticated chat, writes, AutoSim/replay and translation with strict budgets. It is not a full-platform capacity certification.

Recommended production work before claiming the target:

- Separate scheduled ingestion from customer reads and reserve shared refreshes with distributed leases. Current TTL snapshots reduce ordinary repeated collection but do not prevent all cold-start/cache-expiry bursts.
- Move long simulations to a durable queue and bounded workers. Current persisted claims/results prevent replay charges but do not make Edge execution durable after worker termination; establish stale-job reclamation with provider idempotency/budget rules before automatic retries.
- Set per-user and organization budgets, ingress rate limits, circuit breakers and global provider spend limits; existing six/hour research and daily simulation quotas are a baseline, not complete abuse protection.
- Keep pagination and current indexes; use pooled server database access where applicable, examine real query plans, and monitor Realtime fan-out. Avoid per-client subscriptions for global snapshots at high concurrency; prefer shared distribution/CDN or bounded polling.
- Add structured redacted logs, request IDs, error monitoring and alerts for paid-access verification failures, webhook lag, stale observations, translation retries, oldest queue age and failed/stuck jobs. Warm key cooldowns are not globally durable.

Cost categories are Supabase database/storage/egress/Realtime/Edge invocations, AI input/output tokens, translation tokens, licensed news/data feeds, email delivery, Stripe transaction/recurring billing fees, voice CPU/model hosting and monitoring. Estimate from measured usage: `MAU × active sessions/user × feature calls/session × provider unit price`, plus cache-hit adjustment and retries. For example, 50,000 users × 2 AI requests/month × 2,000 input tokens is 200 million input tokens/month **as an assumption only**, excluding output and translation. Do not sell against an unmeasured cost or concurrency claim.

## Validation record and remaining blockers

Local checks include clean npm installation, application tests, frontend TypeScript, ESLint, production build, all Edge Function typechecks, disposable migration/RLS/billing/translation checks, Python crawler/voice tests, and real Chromium route/flow checks at three widths with controlled provider fixtures. Browser fixtures validate UI behavior; they do not validate private hosted API keys or live payment fulfillment. Final counts and dependency advisory status are appended below after the completed run.

Remaining release blockers: apply/accept staged schema; configure/deploy billing and webhook; test hosted paid/unpaid access; verify actual AI keys/model access and quotas; approve translation rights and test real translation quality across the nine languages; verify hosted news and macro freshness; configure scheduled workers, alerting and budgets; load-test measured capacity; verify Lovable synchronized build and smoke-test its real domain. **Do not activate production billing, enforce the production paid policy, or publish automatically.**

### Dependency advisory outcome

The official npm bulk advisory service identified 24 affected package names in the original lock. After refreshing compatible dependencies and updating React Router, Vite and Vitest, the verified lock has one remaining advisory: development-only `braces@3.0.3`, GHSA-vfj7-8cjw-p6xm (high: deeply nested pattern stack exhaustion). No patched version was published by the registry at audit time. It is pulled by Tailwind's build-time file/glob tooling, not a customer runtime feature. Build only trusted source/configuration and do not accept user-supplied glob patterns into CI. Track the upstream fix; this report does not claim zero vulnerabilities. Other patched transitive tool dependencies are pinned by reviewed overrides and a clean-install check.

Analytics also removes the old Markov-engine/probability charts for the descriptive rule and handles provider failure without an unhandled rejection. Missing probabilities are no longer displayed as zero estimates.

The old SWC transform's latest native carrier could not load under this cloud filesystem ownership layout. Vite and Vitest now use the compatible Babel React plugin, avoiding a local-only native binary workaround. Node.js 22.12+ is required. PGlite is an explicit dev dependency, so migration checks work after a normal clean install.

### Completed local validation

- Clean `npm ci` passed with the refreshed lock. Frontend TypeScript passed; ESLint has zero errors and eight existing component-export warnings. Production build passed (nonblocking bundle-size warning).
- 175 application tests passed across 29 files, including authenticated discovery search bounds, HTTP 401/402/403/429/502/503 error handling and eight-key failover. All 20 Edge Function entrypoints typechecked.
- Disposable PGlite migration/RLS/billing/translation tests passed. The Drizzle CLI starts with the patched transitive compiler.
- 14 Python crawler tests and 5 voice tests passed. These fixture tests do not establish external publisher availability or successful model transcription.
- Chromium passed 30 route/viewport checks at 390, 768 and 1440 pixels with zero page errors, plus constrained Nasdaq submission, 500 visual representatives, replay, cohort interrogation, short-height Intel composing, Quick Sim, Research Chat, screenshot expansion and an anonymous deep-link membership gate. Provider responses were controlled fixtures.
- Supabase Auth: HTTP 200; unauthenticated chat and AutoSim: HTTP 401; hosted billing and regime: HTTP 404. Lovable preview connection failed from this environment.
- A fresh four-worker, read-only publisher collection did not complete within a three-minute audit budget and was stopped without uploads. Completed source count and collected articles were not available in its final output. All 287 candidates remain **unverified as a complete active network**. The crawler's synchronous DNS resolution/per-source collection latency remains a capacity concern that must be tested on the real ingestion host; do not bypass its public-address checks to obtain green results.

Customer requests now also have explicit deadlines for Intel chat, Analytics, News, billing status/checkout and synthesis. Timeouts release loading controls and use the existing error UI; they do not assert that an ambiguous paid job did not run. Quick Sim preserves the original pending request ID for recovery.
