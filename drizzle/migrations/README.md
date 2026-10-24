# Canonical production migrations

Vulture Vision now deploys its schema from **`supabase/migrations/` exclusively**.

The former Drizzle migrations 0001 (AutoSim), 0002 (Stripe), and 0003 (workspace security) have been consolidated without functional SQL changes into:

`supabase/migrations/20261021020000_autosim_billing_workspace.sql`

The canonical path automatically orders these dependencies after:
- `20261020040000_news_source_status.sql`
- `20261021010000_headline_translation.sql`

The original Drizzle SQL is retained in Git history; **do not replay it**, or run `drizzle-kit migrate` for this legacy schema. A previous partial migration may require explicit preflight/reconciliation before the new consolidated migration is applied; never drop existing paid customers or subscription records.

`npm run test:migrations` exercises all canonical SQL in a disposable PGlite database. This is not a hosted deployment test.

**Billing remains disabled** and `workspace_release_policy.paid_access_required=false` until successful staging Stripe payment and membership enforcement tests. Do not publish premium workspace access to unpaid users in this state. Once ready, enabling the paid policy requires explicit reviewed production approval.
