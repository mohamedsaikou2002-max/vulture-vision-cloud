# Project conventions — Vulture Vision paid Vercel release

This file applies to the paid staging release branch. Current product requirements supersede the older public/free-workspace instructions.

## Preserve the application
- Preserve the original terminal design, React/Vite routes, dashboards, news catalog, Nasdaq analytics, AutoSim, Quick Sim, Research Chat and optional operator panels. Do not replace the app with a scaffold or redesign the existing UI.
- Preserve route semantics: AutoSim at `/simulations`, Quick Sim at `/simulations/simple`, customer Research Chat at `/research`; redirect `/simulations/pilot` to `/research`.
- Keep landing styles scoped to public pages and avoid changing existing research/terminal behavior. Preserve portable video, lazy-loaded R3F graphics, and privacy-enhanced YouTube demo with a direct fallback link.
- Route AI provider calls through server-side credential transport, preserve bounded requests and Retry-After behavior, validate responses and provide source provenance. Never claim an untested provider or model is live.

## Authentication, billing and data
- Public routes include brand, pricing, login and password-reset pages. Workspace routes require a valid Supabase Auth JWT plus **server-confirmed Stripe paid entitlement**; a logged-in unpaid account may manage its account but may not read premium research.
- Reuse the reviewed paid code in PR #18. Do not restore public-workspace RLS policies or use user-editable JWT metadata for entitlements. Preserve owner-only scenario/history access and operator-only functions.
- Stripe Checkout and Billing Portal are server-authorized. Verify Stripe webhook raw-body signature, use idempotent events and server-owned subscription state. `BILLING_ENABLED=false` until test-mode checkout, payment failure, cancellation, entitlement and isolation tests succeed. Do not mistake live Stripe API access for test-mode credentials.
- All browser configuration uses the current **Vulture vision** Supabase project `sqxnulqhmykvlgxxvhmt` (US east). The project was empty at the start of the November 9, 2026 cutover; do not mistake a healthy project for deployed app schema/functions.
- Apply database schema **only** from ordered `supabase/migrations/`; inspect the remote migration ledger and target project before `supabase db push --remote`. Do not run destructive remote reset or replay migrations from a different project. Run security advisors after applying changes. Never deploy historical private data into public tables.
- Keep service-role, Stripe, AI, worker, and management keys only in protected server secrets. Do not put them in Vite `VITE_` env vars, code, or frontend assets.

## Sources and simulation correctness
- Continue bounded RSS ingest and optional WarWatch context with attribution, timestamps, source health, deduplication, and lawful access. RSS availability does not convey full publisher redistribution rights.
- Existing Nasdaq daily analytics are historical/daily, not an exchange-direct live feed. Label delay/staleness, and only add real-time exchange feeds after confirming vendor contracts, display rights, redistribution permissions and user entitlements.
- Share the deterministic AutoSim calculations between browser and backend. Label uncalibrated assumptions, missing input values and simulated outcomes; do not present projections as certain forecasts. Add independently editable parameters only behind deterministic tests and provenance.
- Public charts should never make premium raw feeds available through unauthenticated direct requests, exports or server endpoints.

## Hosting and release
- **Vercel is now the frontend deployment target**. Use `vercel.json`, `npm run build:vercel` and `dist`, retaining legacy `netlify.toml` only for rollback. Do not deploy the default `main` branch as a paid app until the release PR is reviewed and merged.
- Use the purchased custom domain only after Vercel confirms its DNS configuration and HTTPS. Configure Supabase Auth and Stripe redirect URLs for the exact allowed origins. Do not invent DNS entries.
- Supabase Edge Functions and PostgreSQL deploy separately; Python crawler, translation/context workers, and Whisper gateway need separate always-on compute. Frontend deployment does not deploy them.
- Maintain unit, migration, lint, typecheck, hosted-auth, billing, RLS and live-source checks. Preserve the old Lovable deployment until verified cutover and rollback plans are accepted.
- Follow `docs/VERCEL_RELEASE.md` and `docs/AUTH_STRIPE_LAUNCH.md` as launch gates; no claims of live market feeds, live paid subscriptions or production readiness without evidence.
