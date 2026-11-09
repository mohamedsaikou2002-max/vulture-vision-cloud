# Vulture Vision — Vercel + independent Supabase launch

Status: **pre-production**. This is a release runbook, not evidence of a deployed frontend, live database schema, licensed live feeds, or functioning payments.

## Fixed project and source control

- GitHub repository: `mohamedsaikou2002-max/vulture-vision-cloud`.
- Feature-complete paid code under review: `release/netlify-independent-supabase-20261107` (draft PR #18). Do **not** deploy the free-access `main` version as a paid site.
- Independently owned Supabase project: **Vulture vision**, ref `sqxnulqhmykvlgxxvhmt`, region `us-east-1`. Read-only inspection on 2026-11-09: ACTIVE_HEALTHY but **no public tables, applied migrations or Edge Functions**.
- Earlier Supabase project `kfqyprcxnqiofzmwhxgg` was inactive. Do not route new deploys to it or to the old Lovable-managed ref `wfxjufhqdgzajidciwxb`.
- Keep the old deployment available for rollback until tests pass.

## 1. Provision the existing empty Supabase project

From a fresh local clone of the **paid release branch**, with Supabase CLI installed and authorized as an administrator of this project:

```bash
npm ci
npm run test:migrations
npx supabase --version
npx supabase login
npx supabase link --project-ref sqxnulqhmykvlgxxvhmt
npx supabase migration list --remote
npx supabase db push --dry-run --remote
```

Confirm the `Target:` is `sqxnulqhmykvlgxxvhmt`, review every SQL migration and the history (expected empty on initial inspection), and only then apply:

```bash
npx supabase db push --remote
npx supabase migration list --remote
```

Never run `supabase db reset --remote`, mass-copy the old database blindly, or replay migrations already present in the remote ledger. Keep the latest member-access restriction and the DDL-trigger hardening migration enabled. Confirm RLS and grants with the Supabase advisors. Cloud schema deployment and Edge Functions are **separate** operations.

## 2. Deploy the functions and configure server-only secrets

Review `supabase/config.toml` and `docs/AUTH_STRIPE_LAUNCH.md` first. Deploy functions from the paid release branch with the Supabase CLI, or through the repository's manual Deploy Supabase functions Action after configuring the correct GitHub management token and the double-confirmation project ref. Do not deploy to the older project.

Functions needed for the existing product include `vv-billing`, `stripe-webhook`, `vv-news`, `vv-analytics`, `vv-market`, `vv-regime`, `vv-chat`, `vv-intel-brief`, `vv-autosim` and `vv-simulation-chat`. Test each with a valid paid identity after deployment. The billing and AI handlers do their **own** token/entitlement checks; do not infer protection from `verify_jwt=false` alone. Public Stripe webhook must validate the raw signed payload.

Configure AI keys, FRED if used, provider credentials, subscription price IDs, worker tokens and Stripe secrets in Supabase project secrets **only**. Keep `BILLING_ENABLED=false` until a full sandbox checkout and signed-webhook test completes.

## 3. Supabase Auth and Stripe

Enable email/password, email verification and recovery; optionally Google OAuth, with callbacks limited to the correct project/domain. Auth Site URL and allowed redirects must use your actual HTTPS domain and restricted preview origins.

The current archived paid offer is **$99 charged immediately for the first seven days, then $1,050 monthly**. The first seven days are *not* free. The browser, server-side price validation and Stripe prices must always match. This plan must be confirmed before creating customer-facing live prices.

The available Stripe connector was inspected in **livemode**. Do not run testing purchases or generate test-mode payment objects with a live-mode context. Configure separate test-mode credentials and prices in Stripe, and set a signed webhook destination at:
`https://sqxnulqhmykvlgxxvhmt.supabase.co/functions/v1/stripe-webhook`.

Test checkout, successful webhook, paid access, canceled/expired/failed subscriptions, Billing Portal, duplicate event replay, and cross-account access denial. Only after a complete pass should the live Stripe context and `BILLING_ENABLED=true` be considered.

## 4. Vercel: build without modifying Vulture Vision's UI

Connect this GitHub repository to the Vercel account that owns your domain. Configure the deployment branch to the tested paid release branch for preview; use `main` for production only after a reviewed merge.

- Framework: Vite; root: repository root; Node >= 22.12.
- Build command: `npm run build:vercel`; output directory: `dist`.
- `vercel.json` provides SPA deep-link rewrites.
- Vercel Production / Preview build variables: `VITE_SUPABASE_URL=https://sqxnulqhmykvlgxxvhmt.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=<public publishable key for THIS project>`, optional matching `VITE_SUPABASE_PROJECT_ID=sqxnulqhmykvlgxxvhmt`.
- No Stripe API secret, database password, Gemini key, Supabase service-role key or worker token may appear in a `VITE_` variable. Vite embeds `VITE_` values in the public browser bundle. Rebuild after changing those variables.
- Configure the previously purchased custom domain in Vercel; follow the provider-specific DNS verification instructions. **Do not invent DNS values or infer domain ownership.** Confirm HTTPS before using it in auth redirect rules and billing settings.

A Vercel frontend deploy cannot run the long-lived Python news crawler, background translation/context workers, or Whisper service. Host and monitor them separately.

## 5. Data contracts and licensing

- The existing Nasdaq 60-session analytical series is **not** exchange-direct real-time market data. Before advertising a real-time feed, obtain appropriate exchange/vendor agreements for both live display and any downstream data redistribution, enforce contract entitlements, store timestamps, and show a visible delayed/stale mode when needed.
- Publisher RSS links are **not** guaranteed syndication or republication rights. Maintain each publisher's written permissions and allowed content fields. Use licensed content or excerpt/link/attribution policies permitted by each source; remove sources on request.
- Never call an external API 'guaranteed live' without operational SLAs, source-health telemetry and appropriate contractual rights.

## 6. Release gates

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run test:migrations
npm run test:deployment
npm run build:vercel
npm run check:backend -- --ai
npm run check:site -- https://YOUR-VERCEL-PREVIEW.vercel.app
```

The backend check must be updated for authenticated endpoints if it expects public reads. Run real browser and server-side checks for login, unpaid access denial, successful and failed payments, subscriptions, Nasdaq, news attribution, translation, simulation/replay isolation and AI intelligence. Check Supabase security advisors again. Monitor log errors, stale feeds, quotas and payments. Do not advertise a production launch until the entire gate is green.

Official deployment docs: https://vercel.com/docs/frameworks/frontend/vite and https://supabase.com/docs/guides/deployment/database-migrations.
