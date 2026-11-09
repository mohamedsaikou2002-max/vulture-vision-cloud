# Vulture Vision — standalone backend package (personal Supabase)

## What's included

This ZIP exports actual backend source from the paid release branch of `mohamedsaikou2002-max/vulture-vision-cloud`, not generated placeholder code. It includes:

- `supabase/functions/`: all existing Edge Function source, with shared AI, authorization, billing, WarWatch, Nasdaq, simulation and source-ingestion modules;
- `supabase/migrations/`: **all ordered SQL migrations** including paid-user access and the Nov 9 security permissions fix;
- `supabase/config.toml`: portable local CLI project alias (actual remote link supplied explicitly);
- `news-crawler/`: Python news collection, source catalogs, related tests, Dockerfile;
- `deployment/`: optional crawler/Whisper/other service configurations and attribution/license records;
- `drizzle/`: archived schema context **only** (do not independently apply Drizzle migrations; Supabase migrations are canonical);
- `scripts/`: guarded personal-project bootstrap and database health/migration check scripts;
- `docs/`: relevant launch, API, news and deployment requirements;
- `backend.env.example`: public project coordinates and empty secret placeholders;
- `BACKEND_MANIFEST.json`: SHA-256 manifest of every included source file.

The personal Supabase project is: **`sqxnulqhmykvlgxxvhmt`** (`https://sqxnulqhmykvlgxxvhmt.supabase.co`).

## What a ZIP cannot contain

It **does not** contain inaccessible Lovable database rows, actual provider credentials, Stripe signing keys, Supabase service-role credentials, live paid market-feed contracts or live publisher redistribution licenses. No production cloud resources are created just by extracting this ZIP. Although the source is portable and locally editable, the deployed app still calls whichever PostgreSQL/API backend you configure, or requires you to host compatible services yourself.

The old Lovable project is neither necessary to use this source nor safe to delete until any needed data/backups have been migrated.

## Integration into the existing Vulture Vision frontend

1. In VS Code, check out the original Vulture Vision repository and use the **paid release branch** `release/netlify-independent-supabase-20261107`. Keep your working tree/backup intact.
2. Extract `VultureVision-Standalone-Backend.zip`. Open the inner `VultureVision-Standalone-Backend` folder.
3. Copy/merge `supabase/`, `news-crawler/`, and `deployment/` into your existing Vulture Vision root. Merge `docs/` and `scripts/` as needed. **Do not delete frontend `src/` or overwrite newer changes without reviewing the diff.**
4. Keep `backend.env.example` as a template; do not commit secrets.
5. Ensure your Vercel frontend uses `VITE_SUPABASE_URL=https://sqxnulqhmykvlgxxvhmt.supabase.co` and the **publishable** client key belonging to the **same** project. Never use the Supabase `service_role` key in a browser, `VITE_` variable, or Git.

## Safe migration procedure (not executed by this package)

From the extracted backend root, on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-personal-supabase.ps1
```

For Bash/WSL/macOS:

```sh
bash scripts/setup-personal-supabase.sh
```

These commands log you in to Supabase, link only the known personal ref, list remote migrations and run a **non-writing dry-run**. Review every SQL statement, RLS policy and the target project's migration ledger before applying.

To apply verified migrations, explicitly rerun with PowerShell `-Apply` or Bash `--apply` and type the displayed confirmation. If the personal database already contains customer data, stop and create a backup before proceeding. Never issue `db reset --remote`.

### Edge Function deployment

Use the Supabase CLI from the full Vulture Vision repository root with the correct project link. Before deploy, review `supabase/config.toml` and each function's `verify_jwt` and internal authorization logic.

```sh
npx supabase functions deploy --project-ref sqxnulqhmykvlgxxvhmt
```

The CLI installs/releases Edge Functions; database migrations must be deployed separately. Use restricted operator allowlists for privileged research endpoints. Set provider, worker and Stripe secrets in the private Supabase dashboard; do not add them to the ZIP.

## Stripe and authentication

The paid release code supports Supabase Auth, Stripe Checkout, Billing Portal and signed webhook handling. Those services are not operational until project secrets, providers, URLs and **test-mode** webhooks are configured.

Signed Stripe webhook endpoint:
`https://sqxnulqhmykvlgxxvhmt.supabase.co/functions/v1/stripe-webhook`.

Maintain `BILLING_ENABLED=false` until test-mode checkout, event replay and canceled/expired/failed-subscription access tests succeed. The previously specified $99 for the first seven days followed by $1,050/month must be approved and transparently disclosed before enabling real payments.

## External compute & data limitations

The Python crawler and optional Whisper processor need a separate always-on host. A Vercel static frontend and a Supabase database alone do not run the crawler continuously. The news catalog is a list of candidates, not proof that every publisher feed is online or lawfully licensed for redistribution. Nasdaq historical analytics do not confer rights to exchange-direct real-time data.

## Before monetizing

1. Review and apply canonical Supabase migrations and confirm all app tables exist.
2. Deploy and test production Edge Functions and health checks.
3. Configure real server-only AI/news provider secrets and publisher permission policies.
4. Configure email/Auth redirect URLs on the exact custom domain.
5. Perform Stripe sandbox testing with signed webhooks and member/nonmember authorization checks.
6. Deploy the **paid** frontend release branch on Vercel, test the full app, then promote after explicit approval.
7. Re-run Supabase security advisors and verify source freshness, RLS isolation, logs, rate limiting, backups and budget alerts.

See `docs/VERCEL_RELEASE.md` and `docs/AUTH_STRIPE_LAUNCH.md` for detailed release gates.
