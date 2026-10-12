# Audit remediation — October 12, 2026

The patch corrects duplicated simulation evidence, resolves explicitly selected recent stories, preserves a single decision against a baseline, checks UTF-8 payload size, guards privileged legacy handlers with verified operator access, removes static live headlines and unverified online labels, publishes safe worker health, paces context claims at one per minute, isolates slow publisher jobs, and saves browser-session simulation checkpoints by signed-in account.

## Validation
Before the workspace disconnected: frontend typecheck passed; all 16 Vitest tests and 7 crawler tests passed; Deno checked every Edge Function using an import map to the installed Supabase SDK (direct esm.sh access was unavailable); PGlite verified every migration, client permissions, queue leases, updates during synthesis, retained last-good context and budget exhaustion. ESLint reported zero errors and seven existing component-refresh warnings. Lazy routes reduce initial loading. The remotely recovered patch must pass GitHub CI before merge.

Migration checks locally require: npm install --no-save --package-lock=false @electric-sql/pglite@0.3.14, followed by npm run test:migrations.

## Connected database
The five October migrations were executed together in a transaction and verified afterward. All ten expected tables exist. Anonymous direct reads were removed; authenticated direct reads are restricted to news_articles, news_prompt_versions and tor_entries. Worker status is waiting, with zero attempts. No live news or prompt exists yet.

Migration-history reconciliation is pending: automatic approval review rejected empty statement-list records. Compare the exact executed SQL and deployed definitions before recording migration versions through the supported Supabase workflow. Do not blindly replay non-idempotent CREATE TABLE or policy statements on this project.

## Deployment still required
After approved merge and Lovable synchronization, deploy all changed Edge Functions. Configure MIROFISH_ALLOWED_USER_IDS before operator use. Do not publish until unauthenticated and non-operator requests return 401/403 and the operator health check succeeds.

Host the protected MiroFish backend and supervised live_pipeline.py worker. Supply server-only Gemini, Zep, gateway and worker credentials. The news worker is near-real-time polling; publisher publication and crawl limits prevent an instantaneous global guarantee.

Browser checkpoints survive a page reload in the same tab; upstream process memory is not durable. Lost mutation responses can still require operator inspection. Report cancellation stops monitoring; it cannot cancel an upstream report task. Server job ownership, durable orchestration, persistent simulation budgets and idempotent mutation handling remain prerequisites for multi-tenant public access. Keep the operator-only pilot restriction.

No paid provider simulation, external hosting deployment, or public app publication has been completed.
