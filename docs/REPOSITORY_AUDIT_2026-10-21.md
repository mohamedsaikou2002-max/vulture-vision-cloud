# Vulture Vision — repository audit and remediation log

**Audit date:** 2026-10-21  
**Branch reviewed:** `fix/english-responsive-security-audit`  
**Scope:** repository tree (354 tracked entries), React/Vite entry points and major routes, Supabase Edge Function authorization/billing/news paths, SQL migrations, CI workflow, Python news crawler, voice service, deployment compose file, and existing test suites.  
**Method:** static source/config review plus GitHub Actions CI. This is not a penetration test and does not establish the state of the live Supabase project or deployed services.

## Executive summary

The repository has useful security foundations: authenticated server-side membership checks, server-owned billing records, Stripe webhook signature verification with timestamp tolerance, request quotas, RLS on key tables, worker-token checks, SSRF defenses in the publisher crawler, and CI coverage. However, release readiness is not established. The most important unresolved items are the staged paid-access policy, dependency vulnerabilities, broad CORS configuration, and the lack of live environment verification.

## Findings

### P1 — Paid-access enforcement is staged, not enabled by default
**Evidence:** `drizzle/migrations/0003_workspace_security.sql` creates `workspace_release_policy.paid_access_required` with default `false`. The workspace RPC deliberately returns access when that flag is false. AuthGate is only a frontend gate; server-side authorization is the real boundary, so a false policy value means authenticated users can pass membership checks without an active paid subscription.

**Impact:** if this migration has been applied with its default and the release flag has not been set, paid access is not actually enforced despite the membership UI.

**Action:** confirm the live database value and the intended release policy. Enable paid access only after the Stripe staging checklist and recovery path are verified; do not change this automatically in a code-only audit because it could lock out legitimate users or change a staged release decision.

### P1 — Dependency audit reports eight high-severity vulnerabilities
**Evidence:** GitHub Actions dependency installation reported eight high-severity npm vulnerabilities. The individual advisory list and exploitability have not yet been reviewed.

**Impact:** affected packages may expose the browser app, build pipeline, or server-side tooling depending on the advisory and dependency path.

**Action:** run `npm audit --json`, identify direct/transitive paths, update to patched compatible versions, and rerun tests. Avoid blindly applying `npm audit fix --force`.

### P1 — Full validation was previously blocked by lint
The first CI run failed on `prefer-const` in `src/integrations/supabase/previewAuthStorage.ts`. The branch was updated to initialize the timeout before registering/sending the message, avoiding the lint error and the small risk of a synchronous response arriving before the timer exists. Lint and TypeScript then passed, but the test suite exposed two pre-existing test issues: Gemini fallback tests expected an unsupported model name, and a simulator UI test imported the live Supabase client without test environment variables. The branch now aligns those expectations with the configured fallback policy and mocks the unrelated RecentNews child in that UI test. CI was rerun; verify the latest Actions result before merging.

### P2 — CORS is permissive across multiple Edge Functions
**Evidence:** shared authorization and multiple Edge Functions return `Access-Control-Allow-Origin: *`.

**Impact:** wildcard CORS is not by itself an authentication bypass when bearer authorization is enforced, but it permits browser calls from any origin and increases the impact of any endpoint that is accidentally left unauthenticated or has overly broad authorization.

**Action:** use an explicit production-origin allowlist for browser-facing functions, keep OPTIONS behavior correct, and verify every function's auth path. Keep webhook and server-to-server worker endpoints separate from browser CORS policy.

### P2 — Operator ingestion endpoints need additional hardening
**Evidence:** `vv-tor-ingest` parses a request JSON body and inserts a list of supplied records without an explicit body-size or item-count cap. It is operator-authorized, which reduces exposure, but limits are still needed to protect the function and database from mistakes or compromised operator credentials. Operator-only history functions should also reject unsupported HTTP methods consistently. The kill-switch handler was changed so mutations are POST-only; GET remains read-only.

**Action:** cap request bytes, cap batch item count, validate each field and URL, and return bounded errors. Add negative tests for oversized batches and malformed input.

### P2 — Translation enforcement must be consistent across all surfaces
**Evidence:** the News page now prefers translated English and suppresses common non-Latin headlines when a translation is unavailable. The publisher feed endpoint filters CJK headlines without translations. Other surfaces, including the simulator's RecentNews panel and intelligence synthesis path, consume indexed articles and cached RSS metadata; the latter can lack explicit language metadata. The simulator's RecentNews panel now selects translation metadata and suppresses rows that are neither translated nor explicitly English.

**Impact:** the News view is safer, but static review cannot prove that every page, generated brief, or cached payload is English-only. A Latin-script foreign-language headline can also evade script-only detection when source language metadata is missing.

**Action:** centralize a verified-English eligibility rule, use language metadata/detection rather than script alone, and test all data surfaces. For non-English content with no translation, fail closed in display and AI prompts; preserve original text internally for audit.

### P2 — Deployment settings and live database state are unverified
**Evidence:** `.env` was removed from the proposed branch and a placeholder `.env.example` was added. The file held frontend Supabase URL/project/publishable-key configuration, not a service-role key. Removing it means deployment/build variables must be configured explicitly. SQL migrations and worker schedules are present in the repository, but this audit did not query the live project.

**Action:** verify frontend build variables, Edge Function secrets, worker tokens, translation-worker schedule, crawler/context worker health, migration application status, and production origin settings in the actual deployment.

### P3 — Global responsive rules were over-constrained
**Evidence:** the previous global `html, body, #root` rule used `width: 100vw; height: 100vh; overflow: hidden`, conflicting with normal page scrolling. This was changed to content-driven height and normal document scrolling, with mobile adjustments.

**Action:** perform real viewport tests at 320, 375, 390, 768, 1024 and desktop widths, including the simulator, research chat, news archive, keyboard-open mobile view, and reduced-motion preference. CSS inspection is not a substitute for browser verification.

## Positive controls observed

- Stripe webhook verifies HMAC signature against the raw request body, enforces a timestamp window, re-reads authoritative Stripe subscription state, checks customer-to-user ownership, and applies idempotent database updates.
- Billing checkout uses server-configured Stripe price IDs and validates the expected amounts/currency/interval; client-supplied amounts are not used.
- Membership RPC errors fail closed.
- Core operational tables and translation queue/cache have RLS and server-role-only grants in later migrations.
- The Python publisher crawler restricts URLs to approved hosts, rejects non-public resolved addresses, revalidates redirects, honors robots rules, caps response size, and parses XML with `defusedxml`.
- Voice transcription checks session and membership, restricts CORS origins, caps payload size/duration, and limits concurrency.
- Existing tests cover billing signatures, quota/input validation, crawler SSRF rules, provider failures, and some Edge Function regressions.

## Required release gate

Do not call the application fully audited or production-ready until:
1. the CI run for the latest branch SHA completes successfully, including tests, production build, migrations, Deno checks, and crawler tests;
2. all eight dependency advisories are triaged and resolved or explicitly accepted with evidence;
3. the live `paid_access_required` setting is confirmed against the intended release policy;
4. browser responsiveness and translation behavior are tested against the deployed app;
5. Supabase RLS/grants, Edge Function secrets, worker scheduling, Stripe staging flows, and production CORS are verified in the live environment.

## Limitations

This report reflects static review and CI evidence available at the time it was written. No production database was queried, no real customer billing flow was executed, no penetration test was performed, and no live browser/device test was run.
