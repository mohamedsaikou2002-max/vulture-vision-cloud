# Project conventions
- Keep public brand and membership pages outside the workspace authentication guard so visitors can read the offer before signing in.
- Keep landing styles scoped under public page classes; existing terminal pages retain their styling and behavior.
- Use an asset pointer for the original uploaded video and lazy-load the decorative R3F contours so media and content remain available if WebGL fails.
- Embed the public demonstration with YouTube's privacy-enhanced player and retain a direct watch link so playback has an external fallback.
- Reuse existing account identities or create anonymous guest sessions automatically; never expose other users' research or backend service credentials.
- Workspace access is free. Do not restore Stripe checkout or paid enforcement. Deploy only ordered migrations after checking the remote ledger; private research ownership and operator access remain protected.
- Keep AutoSim at /simulations, Quick Sim at /simulations/simple and customer Research Chat at /research; redirect /simulations/pilot to /research. Preserve separate backend operator allowlists.
- Share the deterministic AutoSim calculation engine between browser visualization and server calculation; label its uncalibrated and missing-data assumptions explicitly.
- Claim AutoSim jobs atomically server-side before provider calls; replay IDs cannot launch another run and agent questions use the existing research quota.
- Scope AutoSim and public information styles to their own page roots to prevent changes to the existing terminal and pilot pages.
- Route all Gemini provider calls through the server-only shared credential transport: discover numbered secret slots, fail over only on HTTP 429, honor per-model Retry-After in warm workers, preserve a total request deadline and sanitize errors; Google remains the quota authority and worker cooldowns are not globally durable.
- Keep model candidates in the shared chat contract and advance only on HTTP 404; use model-specific generation settings to avoid sending legacy thinking controls to newer models.
- Keep additional RSS subscriptions and combined publisher metadata in the Cloud news registry; collect bounded rotating batches with robots, access restrictions and source diagnostics, and retain original research flags.
- Member Intel chat and Cloud brief synthesis use authenticated server-side validation and the existing shared research quota; MiroFish operator-only functions retain their allowlist.
- Persist Cloud-generated briefs and live RSS metadata in expiring warm state so member pages can read shared evidence without a Python host or invented regime predictions.
- Deploy database changes exclusively from ordered `supabase/migrations/`; the former Drizzle staged SQL is consolidated into the 20261021020000 canonical migration, not a second deployment path. Do not replay schema already recorded in Supabase migrations.
- Render workspace routes without a frontend entry gate; retain verified guest identity for backend records and independent operator checks.

- Owner explicitly removed billing and frontend entry gates. Workspace routes are public; use private guest identities for records, retain RLS/operator protections, and never start Stripe checkout or process billing webhooks.
