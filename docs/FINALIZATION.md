# Finalization and publishing

The app has two Nasdaq research views: `/simulations` is the Belicia-style
socioeconomic Pod Room; `/simulations/simple` is the plain-language seven-day
simulator. They use the same authenticated engine, quotas and saved jobs. The
separate MiroFish operator pilot stays at `/simulations/pilot`.

## What is implemented

The shared UI uses Belicia's monochrome glass styling. The full swarm has seven
modeled socioeconomic cohorts, representative dots, local replay, interrogation,
and backend-validated horizon/risk constraints. Dots are not independently
simulated people. Quick Sim provides lower/middle/upper simulated Nasdaq returns
with data gaps kept visible. Intel chat uses a scrolling message region and a
composer that remains visible on small screens; Enter respects IME composition.

Gemini discovers `GEMINI_API_KEY` and numbered `_1` through `_20` slots, removes
duplicates and advances to the next credential on HTTP 429. Per-model Retry-After
cooldowns apply within a warm worker. Google project quotas remain authoritative:
keys in one exhausted project do not create independent quota. No automatic retry
of ambiguous inference errors occurs. Model selection stays in the shared model
contract; model fallback occurs only on 404. Configure a model each key can use.

The attached billing proposal is adapted to the existing schema rather than
replacing it. The offer is **$99 for seven days, then $1,050 USD/month**. This
supersedes the older $99.99 pilot plus additional free-trial copy. Stripe uses an
upfront one-time line item and a monthly subscription with a seven-day deferred
recurring charge. There is no additional seven-day free period.

Billing links customers to `auth.users.id` through a private server-written
mapping. It does not grant access through editable profile metadata or a success
URL. Signed webhooks retrieve current Stripe state, confirm invoice payment and
apply subscription updates transactionally. Event IDs are idempotent; stale
updates and cancellation of an old subscription cannot overwrite a new active
subscription. Concurrent checkout attempts share one Stripe idempotency key.
Invoices and receipts remain in Stripe; the authenticated billing portal provides
customer invoice history and payment-method/cancellation management.

## 1. Verify environment and schema

Use separate staging and production Supabase/Stripe configurations. **The single canonical migration stream is now `supabase/migrations/`.** Run `20261020040000_news_source_status.sql` and `20261021010000_headline_translation.sql` first (where not already recorded), then `20261021020000_autosim_billing_workspace.sql`. This last migration combines the prior Drizzle AutoSim, billing, and workspace release policy SQL in dependency order. Do not run the deleted `drizzle/migrations/0001..0003` files or replay their SQL in another migration system. Inspect the applied migration history and pre-existing tables before applying anything. 

Stage the database release policy with `paid_access_required=false` until actual staging Stripe checkout and entitlement tests succeed. **Do not expose the premium workspace to unpaid users while this flag is false.** `BILLING_ENABLED=false` initially. The new server handlers fail closed if the entitlement RPC/schema is missing. Preserve operator access separately.

## 2. Configure Google sign-in

Enable Google in Supabase Auth and configure the OAuth client/callback required
by Supabase. Set the production Site URL and allowed frontend redirect URLs:
`/welcome`, `/dashboard`, `/simulations`, and `/simulations/simple` on your real
HTTPS origin. Existing public welcome/pricing pages remain readable without
sign-in. Check new and returning Google users have stable Supabase user IDs.
Never derive paid access from `user_metadata`.

## 3. Configure Stripe in test mode first

Create two active USD prices in the matching Stripe account:

- A one-time introductory price of 9900 cents.
- A recurring monthly price of 105000 cents, interval count 1.

Use descriptive product/price names so Stripe Checkout clearly shows the $99
charge now and the $1,050/month renewal after seven days. The backend verifies
price amount, currency, interval and live/test-mode consistency before checkout.

Set these **server-side Supabase function secrets**, never VITE variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_TRIAL_SETUP_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET` (from this exact Stripe endpoint)
- `FRONTEND_URL` (the exact HTTPS frontend origin, no path/query)
- `BILLING_ENABLED=false` initially

The existing server functions also require Supabase URL, anon key and service-role
key bindings. Keep the service-role key private. Frontend only needs its existing
public Supabase configuration. Do not paste secret values into chat or commit them.

Deploy `vv-billing` with normal JWT verification. Deploy `stripe-webhook` with
JWT verification disabled **only for that function**, as configured in
`supabase/config.toml`; it verifies Stripe's raw-body HMAC and a five-minute
signature timestamp tolerance instead. Do not disable verification globally.

Set the Stripe webhook endpoint to:
`https://<project>.supabase.co/functions/v1/stripe-webhook`

Subscribe to `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
and `invoice.payment_failed`. Select the pinned API version
`2025-02-24.acacia` for compatibility with the implemented invoice/subscription
shape. The REST client sends this API version explicitly.

Configure Stripe's customer portal with payment-method updates, invoice history
and cancellation. Do not offer arbitrary product/price switching until those
prices have corresponding server-side entitlement rules. Enable Stripe's
successful-payment receipts and failed-payment reminders; configure business
branding, support contact and tax settings for the actual business.

After schema and endpoint validation, enable `BILLING_ENABLED=true` **in staging**
and complete an actual test-mode checkout with a signed-in user. A synthetic
`stripe trigger` event with no app-owned customer is not a checkout integration
test. Verify that no access is granted before the introductory invoice is paid.
Verify the database customer mapping, `trialing` status, trial end, period end and
price. Check billing portal ownership with two different users.

Test duplicate delivery, delivery out of order, cancellation, payment failure,
recovery, and monthly renewal using Stripe test tools/test clocks. Failed database
writes must produce webhook 500 responses so Stripe retries. A success redirect
alone must not change access. The welcome page reads server-confirmed status.
Monitor undelivered webhook events and reconcile against Stripe before granting
access manually. Replaying a failed uncommitted event is safe; processed event IDs
remain idempotent.

Repeat with production prices, live key and the production endpoint secret only
when the test-mode flow is verified. Test-mode customer IDs cannot be reused in a
live Stripe account; keep those environments' billing mappings separate.

## 4. Verify AI, markets and news

Deploy changed `vv-autosim`, `vv-chat`, `vv-simulation-chat`, `vv-intel-brief`,
`vv-analytics` and the news/context functions as applicable. Set the hosted Gemini
model and key slots securely. Force a controlled 429 in staging or use an exhausted
test credential to verify the next eligible key is used, without printing keys.
Verify exhausted credentials return a quota error rather than fabricated AI.

Run a signed-in Pod Room scenario and a Quick Sim scenario. Both must use Nasdaq
Composite (`^IXIC`), respect their constraints and preserve pending job IDs on
lost responses. Reopen history and create a controlled variant. Check that fresh
FRED/Yahoo observation dates are real and that missing data is labeled. See
`simulator-provider-recovery.md` for the corrected public FRED endpoint and the
consumer-confidence fallback's provenance.

Check news and Intel synthesis against source-linked headlines, and retain source
failure diagnostics. The Cloud news path is described in current source/roadmap;
external collector and Whisper hosting remain optional deployments requiring their
own network access and configuration. If using Whisper, follow
`deployment/whisper/README.md`, obtain a real model and test actual transcription.
The MiroFish pilot still needs its protected external engine/credentials and
retains operator-only access.

## 5. Release checks and publish

Use Node.js 22.12 or newer. Run:

```
npm ci
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
npm run test:migrations
```

The migration check uses PGlite, installed by `npm ci`, and runs only in a disposable local database. Check phone, tablet and desktop layouts,
including short-height screens and an open mobile keyboard. Verify long Intel
replies scroll while Send remains reachable, and verify authentication redirects.

Sync the tested GitHub commit into Lovable and verify its preview. Git push does
not itself prove hosted function deployment, schema application, real payment
success or publication. Configure the real domain and OAuth redirects before
publishing. Keep checkout disabled until its live configuration is accepted and
verified; enable subscription enforcement separately only after entitlement tests.
