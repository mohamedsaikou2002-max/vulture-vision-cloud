# Standalone Netlify + new Supabase cutover (2026-11-07)

## Objective and current state

Run the *existing* Vulture Vision React/Vite application on Netlify, with its own newly provisioned Supabase project for Postgres, RLS, RPCs, and Edge Functions. GitHub is the source of truth. Preserve the application routes, UI, news catalog, socioeconomic/Nasdaq simulations, research panels, AI adapters, and separately hosted crawler/Whisper services.

This branch removes the Lovable Vite development tagger and replaces the old hard-coded Supabase CLI project identifier with a neutral local identifier. It does **not** create a Supabase organization/project, copy old database rows, deploy hosted functions, configure provider secrets, create a Netlify site, change DNS, unlink GitHub from the old Lovable project, or delete any existing project.

The old Lovable-managed database was reported enabled but a read-only metadata inspection on November 7 returned `query_error: Database is possibly not accessible at the moment`. Do not treat the existing hosted schema, live news, or provider status as verified.

## 0. Preserve old deployment and inventory

- Keep the old Lovable project, database, and environment available for rollback until the new site passes real end-to-end tests.
- Inspect and export the original schema, applied migration ledger, table counts and **authorized** data backups before moving or deleting anything. Inspect storage buckets, cron schedules, external worker configuration, function secrets, and any OAuth/provider callback URLs separately.
- The earlier free-workspace revision was public. The 2026-11-07 paid migration restores Supabase Auth + Stripe membership: `public_workspace_jobs` is now member-owned and readable only by its owner with an active subscription. Existing private and billing history must not become public accidentally. Do not restore private rows into public tables.
- If the original database cannot be accessed, migration of **existing data** is blocked. A new Supabase project can still be initialized from migration SQL, but it starts without the old records.
- The old billing endpoints have been restored in this branch, but checkout must remain disabled until a new signed Stripe test-mode webhook is verified. Do not reuse old webhook secrets or payment settings blindly.

## 1. Create the replacement backend (separate Supabase project)

Create a new project under an account/organization you administer at https://supabase.com/dashboard/projects. Record its project ref securely. Use a separate *staging* project if possible; do not run unreviewed SQL against production.

Use Node 22.12+ and the Supabase CLI in a local checkout of this repository:

```bash
npx supabase login
npx supabase link --project-ref YOUR_NEW_PROJECT_REF
npx supabase migration list --remote
npm ci
npm run test:migrations
npx supabase db push --dry-run --remote
```

Review the SQL and proposed migration order before making changes. When the new remote is confirmed *empty* and the dry run matches expectations, explicitly apply reviewed migrations:

```bash
npx supabase db push --remote
```

The canonical SQL stream is `supabase/migrations/`. Do **not** indiscriminately replay an old project's migration ledger or use `supabase db reset --remote` to fix errors. The targeted October 26 repair exists for databases missing specific schema; check whether it is appropriate for a fresh project before applying it. Confirm the migration list and inspect the resulting tables/functions, RLS policies, public grants, and service-role-only RPC permissions. Preserve existing private tables' protection. Follow `docs/FREE_WORKSPACE_RELEASE.md` and `docs/LIVE_ERROR_REPAIR.md`.

If preserving existing **authorized** public history or articles, export and migrate data from the previous database after schema validation, with primary keys, dependencies, ownership, copyright/retention requirements and row-level access checked. An initial empty database is not a copy of the old data.

## 2. Configure backend functions, secrets and workers

Repository Actions variables:

- `SUPABASE_PROJECT_REF`: **new** project ref
- `SUPABASE_PROJECT_REF_CONFIRM`: identical new project ref, required to deliberately acknowledge the target

Repository Actions secret:

- `SUPABASE_ACCESS_TOKEN`: Supabase management personal access token for the new project, **not** a publishable or service-role key

The manual `Deploy Supabase functions` workflow rejects the old project ref and unequal confirmation. Run the workflow from the reviewed **main** branch only after the new schema exists; check the Deno typecheck and function deployment output. GitHub does not apply database migrations automatically.

Configure Gemini/model credentials and any data-provider keys in **Supabase function secrets**; keep service-role keys, AI keys, crawler credentials, worker tokens and Stripe keys off the frontend and out of Git. Validate which functions are public versus operator/worker-only; respect `supabase/config.toml` JWT settings and enforce server-side authorization for sensitive calls.

The external Python crawler, long-running translation/context workers and optional Whisper service cannot run on static Netlify hosting. Deploy and test them separately if those features are required, including schedules, TLS/CORS and actual translated/source rows. Do not claim complete publisher coverage merely from the catalog.

## 3. Connect GitHub to Netlify

In Netlify import the GitHub repository `mohamedsaikou2002-max/vulture-vision-cloud`. Choose main only after the migration pull request has passed review and CI. The existing `netlify.toml` uses `npm run build:netlify`, publishes `dist`, and handles SPA deep links and static asset 404s.

Set Netlify build environment variables using the **new** project's API settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_NEW_PUBLIC_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_NEW_PROJECT_REF
```

Optional: `VITE_VOICE_HOST` and `VITE_BACKGROUND_VIDEO_URL`. Never put `sb_secret_`, service-role, AI/provider, worker, database password, or management tokens into any `VITE_` setting. Vite embeds its public settings at build time, so trigger a new build after switching backend refs.

## 4. Release gate — **NO-GO** until verified

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run test:deployment
npm run test:migrations
npm run build:netlify
npm run check:backend -- --ai
npm run check:site -- https://YOUR_NETLIFY_PREVIEW.netlify.app
```

Use the new backend's public values for the backend check. Existing fixture tests and an earlier local Netlify build are valuable but **not** proof of the new production backend.

Verify: HTTPS domain and fresh navigation, `/news` and English translations, Nasdaq analytics, live Intel reply, simulation and shared-history replay, research panels, real source timestamps, provider error recovery, anonymous database access boundaries and service-only writes. Test both mobile and desktop. Validate function logs and origin restrictions. Test workers and voice separately. **Do not publish an incomplete backend as a completed launch.**

## 5. Cutover and rollback

After live checks pass, connect the custom domain to Netlify, update any allowlisted worker/voice origins and provider callbacks, verify TLS, and monitor errors and cost quotas. Preserve the old deployment and database backups until acceptance. Roll back the frontend with Netlify deploy history; database restoration requires a separate, tested backup plan.

Disconnect GitHub sync/archive or delete the old Lovable project **only after** this acceptance, using the Lovable dashboard. Do not delete the old database until the preservation/recovery and retention decisions are explicit. The current available connector does not offer a remove-project API.

## Reference

- [Netlify release](NETLIFY_RELEASE.md)
- [Netlify verification](NETLIFY_VERIFICATION.md)
- [Public workspace/security notes](FREE_WORKSPACE_RELEASE.md)
- [Known hosted errors](LIVE_ERROR_REPAIR.md)
- [Supabase CLI migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments)
