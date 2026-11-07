# Vulture Vision — Supabase Auth + Stripe billing launch (Netlify)

**Status:** Source implementation is prepared for staging. It is **not** a live subscription service until the new Supabase project, Stripe test environment, functions, migrations, and Netlify preview have all been deployed and tested.

## Preserved architecture

- Netlify: existing React/Vite frontend and responsive dashboard/research routes.
- New independently managed Supabase: Auth, PostgreSQL, restricted RLS, functions, simulation history, news and translation.
- Stripe: hosted Checkout, Billing Portal and **signed** subscription webhooks. No payment key is shipped in the browser.
- Separate hosts: Python news crawler, background context/translation and optional Whisper inference remain separate services.
- The public pages are `/`, `/welcome`, `/pricing`, `/login` and `/reset-password`. Only authenticated users reach `/account`. The workspace routes require **server-confirmed paid membership**.

## Offer

The archived Vulture Vision pricing specification was **USD 99 charged immediately for 7 introductory days**, then **USD 1,050/month** until canceled. The browser displays these terms, and `vv-billing` compares server-selected Stripe prices to exactly these amounts. A seven-day period is *not free*.

To change pricing or policy, update the server and the displayed disclosure together, create the corresponding Stripe prices, and re-test. There are no client-controlled prices.

## Supabase Auth setup

In the **new standalone Supabase project**:

1. Enable Email/Password with email confirmation, recovery mail and appropriate SMTP delivery. Consider rate limits, CAPTCHA and breached-password protection before public signups.
2. If using Google, configure the OAuth client in Google Cloud and Supabase Auth's Google provider. Allow `https://NEW_PROJECT_REF.supabase.co/auth/v1/callback` in Google OAuth.
3. Set the Supabase Auth **Site URL** to the exact Netlify/custom-domain HTTPS origin and allow redirects to `/account` and `/reset-password` (and suitable staging origins). Avoid broad wildcard production redirect patterns.
4. Netlify frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_SUPABASE_PROJECT_ID`. These values are public; never use service-role or Stripe keys with `VITE_`.
5. The browser client persists and refreshes sessions; backend checks tokens with Supabase Auth `getUser(token)`. Auth is not based on editable user metadata.

Verify signup/verification, login, Google OAuth (if enabled), logout, password recovery, refresh and direct deep links. A signed-in customer without a subscription must have `/account` access but no premium data or functions.

## Schema and security

The canonical migrations live under `supabase/migrations/`. The latest **2026-11-07 restore_member_access** migration supersedes the free/public release and changes `public_workspace_jobs` to **owner-only** SELECT with a server-verified paid entitlement. Earlier public-record rows are retained but not assigned to new member accounts. Anonymous news/source reads are revoked; member-only RLS policies are added. Operators and background jobs keep separate trusted-server access.

Inspect the new project's migration list and apply the complete ordered SQL stream **only to that new project**. Do not replay this file against an unknown old database with customer data. Before accepting the release:
- Confirm `anon` cannot SELECT news, source metadata, `public_workspace_jobs`, private history or billing tables.
- Confirm signed-in but unpaid users cannot SELECT these premium objects or invoke member functions.
- Confirm paid user A can access only their own saved scenarios, while user B cannot.
- Confirm `subscriptions`, customer mapping, and webhook events cannot be written by browsers.
- Confirm service-only claim RPCs and operator endpoints still reject customer JWTs.
- Run `npm run test:migrations` and Supabase security advisors on the new project.

Do not use the old `workspace_release_policy` flag as an access bypass. Membership is determined from a Stripe-confirmed subscription and its expiration. The server must fail closed when the subscription schema is missing.

## Stripe: configure test mode first

In a Stripe account you administer, create **active** USD test prices:
- `STRIPE_TRIAL_SETUP_PRICE_ID`: one-time **9900 cents** (USD $99).
- `STRIPE_MONTHLY_PRICE_ID`: recurring monthly **105000 cents** (USD $1,050, interval count 1).

Use Stripe's test secret API key; set server-side Supabase Edge Function secrets:

```dotenv
STRIPE_SECRET_KEY=YOUR_STRIPE_TEST_SECRET_KEY
STRIPE_TRIAL_SETUP_PRICE_ID=YOUR_TEST_ONE_TIME_PRICE_ID
STRIPE_MONTHLY_PRICE_ID=YOUR_TEST_RECURRING_PRICE_ID
STRIPE_WEBHOOK_SECRET=YOUR_TEST_ENDPOINT_SIGNING_SECRET
FRONTEND_URL=https://YOUR-NETLIFY-SITE.netlify.app
BILLING_ENABLED=false
```

These go into **Supabase Edge Function secrets**, never GitHub source or a browser build. The existing server-owned service-role binding must remain private. The function pins Stripe API version `2025-02-24.acacia` to preserve its webhook subscription shape; configure the webhook endpoint for a compatible version and test event payloads against that version before upgrading.

Deploy `vv-billing` and `stripe-webhook`. The webhook is **public only for receiving events** (`verify_jwt=false`) and verifies the raw-body Stripe HMAC and five-minute timestamp window. Do not route checkout through unauthenticated Netlify functions. The billing API validates the **actual Supabase user JWT** before checkout, portal or status; the `config` action reveals only the configured offer and whether checkout is enabled.

Stripe webhook destination: `https://NEW_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`.

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Configure Stripe's customer portal so subscribers can update payment methods, see receipts and cancel.

Only after schema/RLS, webhook, price verification and portal configuration work, change `BILLING_ENABLED=true` in the **test** environment. Complete a real Stripe test-mode Checkout from a new signed-in account, confirm the $99 introductory charge and seven-day monthly deferral, and verify that the signed webhook creates the server-owned entitled subscription. Repeated/out-of-order events must not grant unauthorized access; a redirect alone must never grant access. Verify renewal, expiry, failed payment, cancellation and portal ownership across two user accounts. No live prices/keys until all these scenarios pass.

## Production activation and release checklist

1. Configure a production Stripe account with the exact approved prices, separate **live-mode** key and new webhook signing secret; do not copy test customers or tokens. Confirm receipts, taxes, business/return policies and customer support details.
2. Deploy all customer Edge Functions and the latest migration to the **new Supabase project**. The `authorize` helper requires real user JWTs and server-confirmed membership. Review CORS/ingress, rate limits and provider quotas, and check that sensitive operator endpoints are not exposed.
3. Put correct public Supabase URL/publishable key in Netlify; rebuild the Vite frontend. Configure HTTPS and the authorized Auth redirect destinations.
4. Verify real mobile/desktop login, news, charts, simulations, private replay, AI, translations, saved history and sign-out. Check actual backend health, data timestamps and worker scheduling.
5. Run GitHub CI, `npm run check:backend -- --ai` (will need a member-aware check for paid endpoints), and a real staging browser checkout/webhook test. Existing fixture suites do **not** prove live Stripe processing.
6. Change DNS only after the new release passes. Preserve the old Lovable project and backups until data retention and rollback are accepted.
7. Monitor webhook failures, unpaid-account access denials, function errors, Stripe refunds/disputes, provider budgets and subscription expirations.

**Key rule:** users must never receive premium access merely because they signed in or were redirected from checkout. Paid access must be confirmed by a signed webhook and server-owned subscription record.

Official references: [Supabase Auth](https://supabase.com/docs/guides/auth), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Stripe webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks), [Stripe subscription trials](https://docs.stripe.com/billing/subscriptions/trials).
