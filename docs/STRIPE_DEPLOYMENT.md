# Vulture Vision — secure Supabase + Stripe release guide

**These are two deployment configurations of the same application; they must use different Supabase projects and Stripe modes. The code is not a live payment processor until you configure genuine Stripe credentials, prices and a webhook.**

## 1. Credentials and product catalog (never commit or paste secrets)

The user-provided string beginning with \`wlfv-\` is **not a Stripe API key** (Stripe server keys use \`sk_test_\`, \`sk_live_\`, or restricted \`rk_...\` prefixes). Treat it as potentially exposed, rotate if real, and never place it in project files.

Your Stripe account connection must be authorized separately. Make two Stripe monthly recurring USD prices through the Stripe Dashboard or the connected Stripe plugin:

- Founding Beta: suggested **$79/month**, using **test-mode price** \`price_...\`. Beta test checkout uses test cards and never collects real funds.
- Commercial Pro: suggested **$99/month**, using **live-mode price** \`price_...\` when legally/operationally ready.

Keep price IDs server-side. Checkout verifies the price is an active monthly USD recurring price in the matching mode, and never trusts a price supplied by a browser.

The account owner must activate Stripe Billing and configure the customer portal, business name, cancellation/refund terms, and applicable Stripe Tax registrations before live sales. If enabling \`STRIPE_AUTOMATIC_TAX=true\`, verify registrations and liability first. Stripe Connect payouts are not enabled in these releases: this subscription product does not need a connected-account marketplace.

## 2. Supabase accounts

Google login uses the existing Lovable OAuth-to-Supabase flow. Enable Google OAuth in Lovable/Supabase and allow the actual beta/commercial callback origins. Email/password signup and reset use Supabase Auth.

In **Authentication** configure SMTP deliverability, confirmation-email enforcement, redirect allowlists, password policy, rate limits and CAPTCHA/abuse protections. Users must confirm email before paying. Do not disable Google provider verification.

Deploy \`supabase/migrations/20261016190000_vv_paid_entitlements.sql\` and \`20261016191000_vv_checkout_quota.sql\` after your existing migrations. They enforce:
- private service-role-owned billing customers, subscriptions and signed webhook event ledger
- function \`vv_has_paid_access()\` and paid-only row-level-security SELECT policies for direct news/context/discovery reads
- atomic checkout creation quota, 10 requests/user/hour
- paid access only with matching environment, active Stripe subscription, latest invoice **paid**, and unexpired subscription billing period
- no trial/checkout-return/unpaid/past-due/canceled subscriptions unlocked

**Activate the correct environment only after setting up that deployment:**

\`\`\`sql
-- Beta project only
UPDATE public.vv_billing_environment SET mode='test',updated_at=now() WHERE id=true;
-- Commercial project ONLY (separate database!)
UPDATE public.vv_billing_environment SET mode='live',updated_at=now() WHERE id=true;
\`\`\`

Never connect a beta deployment to a live Supabase database or vice versa. The UI, Edge Functions, Stripe key, event.livemode and DB mode all independently enforce isolation.

## 3. Backend Edge Function secrets

Set secrets per Supabase project through the secret manager (NOT \`VITE_\` variables):

| Secret | Beta | Commercial |
|---|---|---|
| \`VV_BILLING_ENV\` | \`test\` | \`live\` |
| \`STRIPE_SECRET_KEY\` | actual \`sk_test_...\` | actual \`sk_live_...\` |
| \`STRIPE_WEBHOOK_SECRET\` | beta \`whsec_...\` | distinct live \`whsec_...\` |
| \`STRIPE_BETA_PRICE_ID\` | test \`price_...\` | unused |
| \`STRIPE_PRO_PRICE_ID\` | unused | live \`price_...\` |
| \`VV_SITE_URL\` | actual beta origin | actual commercial origin |
| \`STRIPE_AUTOMATIC_TAX\` | \`false\` until configured | \`true\` only with tax registration |
| \`GEMINI_API_KEY\` | test budget key | separately controlled production key |

Supabase URL, anon key and service-role secret must be present in each project's secure deployment environment. Use narrowly scoped Stripe restricted keys where possible; if restrictions prevent subscription/payment APIs, use a server-only secret key until they are adjusted.

Deploy \`vv-billing\`, \`vv-stripe-webhook\`, and all modified premium functions. The Stripe webhook **must be publicly callable without a Supabase JWT** (\`verify_jwt=false\`) and is secured by raw-body HMAC signature, time tolerance, event mode validation, idempotency ledger, and Stripe server-side reconciliation. Do not put webhook secret in client code.

Stripe Dashboard webhook destination:

\`\`\`text
https://<your-supabase-project-ref>.supabase.co/functions/v1/vv-stripe-webhook
\`\`\`

Subscribe to \`checkout.session.completed\`, \`checkout.session.async_payment_succeeded\`, \`customer.subscription.created\`, \`customer.subscription.updated\`, \`customer.subscription.deleted\`, \`invoice.paid\`, \`invoice.payment_failed\`, \`invoice.voided\`, \`invoice.marked_uncollectible\`. Point test and live webhooks to their respective projects, never the same database.

## 4. Frontend build variables

For each frontend release, provide only public Supabase project values via \`.env.local\`:

\`\`\`bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-public-publishable-key>
VITE_RELEASE_CHANNEL=beta # or commercial
\`\`\`

\`VITE_RELEASE_CHANNEL\` controls public UI labels, **not authorization**. The server always performs its own checks.

Start locally: \`npm ci && npm run dev\`. For a compiled deploy: \`npm run build\` and host \`dist/\` on the configured origin. Update \`VV_SITE_URL\` accordingly.

### Private research backends

`vv-research-proxy` is the only allowed browser-facing route to external Azure Intel and Socio-Economics APIs. Set server-only `VV_INTEL_BACKEND_URL` and `VV_SOCIO_BACKEND_URL` (HTTPS base origins) and `VV_RESEARCH_BACKEND_TOKEN` as appropriate; private gateways must independently authenticate the proxy and never expose their HTTP/WebSocket ports directly. Realtime clients now use regular polling until a paid-authenticated Supabase Realtime channel is implemented. Synthesis mutation is operator-only.

## 5. Acceptance checklist — complete before real charges

- Create email account; verify the email link; sign out; sign in; reset password; check Google OAuth redirects.
- Signed-in unpaid user gets paywall and **402 subscription_required** from premium Edge Functions; direct Supabase news tables produce no protected rows.
- Beta Stripe test card completes test-mode monthly checkout; initial return **does not** unlock until verified webhook has populated the ledger.
- After successful invoice and subscription events, paid user can access dashboard, research, and news.
- Cancel through Stripe Portal; check revocation at period expiration. Force failed invoice, past_due, unpaid and deleted states to confirm denial.
- Replay webhook, change event body, wrong \`whsec_\`, stale timestamp, wrong livemode → invalid/replay-safe, never grant.
- Verify a test Stripe subscriber **cannot** unlock commercial environment (both front-end and backend).
- Test missing secret/price/webhook/migration: display unavailable and fail closed.
- Ensure no Stripe key, Supabase service role, Gemini key or provider token is shipped inside the Vite frontend or Git.
- Confirm domain, VAT/sales-tax obligations, Stripe account eligibility for financial research, terms, cancellation and privacy policies before live billing.
- Verify emails and logs omit payment-card information. Cards never touch the application; Stripe-hosted pages collect them.
- Confirm no IBM quantum charges, no automatic trading, no pretend simulation availability.

## Remaining live-account prerequisites
Stripe Products/Prices and secret keys cannot be created without an authenticated Stripe connection. The build **does not** prove real payments. A paid-beta launch requires the Stripe test integration tests above, and a commercial launch requires separate live-mode verification. Keep the commercial release unpublished until these succeed.
