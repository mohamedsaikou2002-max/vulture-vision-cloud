# Milestone 2: Stripe TEST-mode acceptance

This milestone validates the customer journey: signed-in unpaid account -> authenticated Stripe Checkout -> signed invoice event -> paid access -> payment failure / cancellation / expiration -> blocked access.

Automated tests under src/test/stripePaymentLifecycle.test.ts use synthetic events against the actual webhook's shared reconciliation code. They DO NOT constitute a successful real Stripe payment or end-to-end deployment test.

## Required authorizations

- Connect Stripe through Lovable Dashboard > Connectors (Stripe), or connect the Stripe ChatGPT app.
- Configure one Stripe TEST price (monthly, USD) and configure the Customer Portal in TEST mode.
- Provision a separate Supabase **beta** project. Do not use the production Supabase project.
- Apply all migrations, deploy all premium Edge Functions, vv-billing and vv-stripe-webhook. Leave commercial app unpublished.
- Set VV_BILLING_ENV=test, STRIPE_SECRET_KEY=sk_test_... (server only), STRIPE_WEBHOOK_SECRET=whsec_..., STRIPE_BETA_PRICE_ID=price_..., VV_SITE_URL=https://YOUR-BETA-ORIGIN and Supabase service keys in **server-side secret storage**.
- In Supabase SQL Editor for the beta project only, run:

    UPDATE public.vv_billing_environment SET mode='test', updated_at=now() WHERE id=true;

- Register the TEST webhook URL:
    https://YOUR-BETA-PROJECT.supabase.co/functions/v1/vv-stripe-webhook
  Use the event types documented in STRIPE_DEPLOYMENT.md.
- Use a manually created and email-confirmed TEST user. Do not commit its password or paste credentials in chat.

## Terminal acceptance command

Set environment variables privately in your laptop shell:

    VV_BETA_SUPABASE_URL=https://YOUR-BETA-PROJECT.supabase.co
    VV_BETA_PUBLISHABLE_KEY=YOUR-BETA-PUBLIC-ANON-KEY
    VV_BETA_TEST_EMAIL=TEST-USER-EMAIL
    VV_BETA_TEST_PASSWORD=TEST-USER-PASSWORD
    VV_BETA_CONFIRM_TEST_MODE=I_UNDERSTAND_THIS_IS_TEST_ONLY

Then run:

    npm run test:stripe:beta -- preflight
    npm run test:stripe:beta -- checkout

The checkout command returns a private Stripe TEST Checkout URL. Open it personally, complete TEST payment with Stripe test credentials, and allow Stripe to deliver valid signed invoice and subscription webhooks. Then run:

    npm run test:stripe:beta -- paid

Simulate an actual payment failure, immediate cancellation, or expiration with Stripe test tools and confirm the subscription ledger is updated. Then:

    npm run test:stripe:beta -- blocked

You can use a new test user for the unpaid stage to avoid having to cancel the paid test account. Do not confuse cancellation of future renewals with immediate termination: subscribers normally retain coverage until their current paid-through date.

## Acceptance conditions

- Unknown or unpaid users receive HTTP 401 / 402 from research endpoints.
- Invalid webhook HMAC returns 400 without mutating paid entitlements.
- Checkout redirects only to checkout.stripe.com.
- Test invoice paid + active subscription with the correct price and future item billing period enables research.
- Missing invoice, non-paid invoice, past_due, canceled, expired or wrong price deny premium access.
- Test-mode paid entitlement NEVER unlocks commercial mode or a distinct Supabase live project.
- Stripe Portal can manage an existing test customer. Test refund/dispute handling separately before commercial rollout; an invoice may remain 'paid' even after a refund.
- Require user-facing billing policy, refunds/cancellations, privacy terms and Tax setup before live payments.

## Evidence to retain

Document test account ID (never password), timestamp, Stripe test session/event/subscription identifiers, webhook HTTP 200 receipt, Stripe invoice paid status, beta entitlement activation, premium endpoint status before/after and cancellation/failed-payment revocation. Never commit screenshots containing secrets or full payment methods.

For detailed deployment settings, see STRIPE_DEPLOYMENT.md. Do not publish until the real TEST end-to-end checks pass.
