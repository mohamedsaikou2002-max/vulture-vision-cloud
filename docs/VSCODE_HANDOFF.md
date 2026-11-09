# Vulture Vision — VS Code handoff (monochrome, independent Supabase, Stripe TEST)

**Status:** Source-ready for local build/review; **NOT a deployed or payment-verified application**. This ZIP includes the actual React/Vite application and Supabase source from the paid + streamlined branches, with the exact PR #11 workspace styling. It does not contain any passwords, AI keys, Stripe keys, publishable keys, migrated data, or hosted deployments.

## What is included

- The actual Vulture Vision React/TypeScript/Vite frontend and its routes, not a replacement mock UI.
- PR #11's `src/styles/investor-mobile.css` and responsive `src/components/VVLayout.tsx`; normal Dashboard/Analytics/News/Research/Simulator routes, **no investor-demo stubs**.
- PR #20's simplified scenario input → run → results screens, with research-only synthetic modules moved out of the public UI and preserved under `supabase/research/`.
- PR #18's sign-up, login, Google OAuth option, password recovery, membership gate, account, billing API, Stripe Checkout, Stripe Billing Portal and signed webhook.
- SQL migration history, RLS policies, Supabase Edge Functions, publisher crawler and existing standalone deployment configuration.
- Removed Lovable Vite tagger and Lovable AI-gateway fallback. Hosted AI now needs a **direct** GEMINI_API_KEY.
- Stripe integrations reject live API keys; billing is disabled by default until test mode is configured and verified.

## 1. Open in VS Code (Windows PowerShell)

1. Unzip `VultureVision-VSCode-Complete.zip`.
2. Open the extracted `VultureVision-VSCode` folder in VS Code.
3. Open Terminal → New Terminal (PowerShell) and run:

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env.local
code .env.local
```

Requires **Node.js 22.12+**, npm and internet access to install dependencies. If `.env.local` already exists, **do not overwrite it**. In `.env.local`, set these three **browser-visible, public** values from **your own** Supabase dashboard:

```dotenv
VITE_SUPABASE_URL=https://sqxnulqhmykvlgxxvhmt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PROJECT_PUBLIC_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=sqxnulqhmykvlgxxvhmt
```

The publishable key comes from Supabase → project `sqxnulqhmykvlgxxvhmt` → Project Settings → API Keys. Do **NOT** put any `sb_secret_`, service-role key, Stripe secret, Gemini key, webhook secret or management token in `VITE_` variables or source code.

Start the original app locally:

```powershell
npm run dev
```

Open the URL printed by Vite (typically http://localhost:8080). The UI loads locally, but data, auth and billing actions require the hosted backend to be configured.

## 2. Run preflight checks before changing the cloud project

```powershell
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run test:migrations
npm run test:deployment
npm run build:netlify
```

If any command fails, **record the full error and address its cause** before advancing; don't ignore it. Test results in GitHub CI, when available, do not substitute for authenticated hosted end-to-end checks.

## 3. Link the CLEAN Supabase project and review its migrations

Use the correct project **ref `sqxnulqhmykvlgxxvhmt`**, not the old Lovable project. In the project root:

```powershell
npx --yes supabase --version
npx --yes supabase login
npx --yes supabase link --project-ref sqxnulqhmykvlgxxvhmt
npx --yes supabase migration list --remote
npx --yes supabase db push --dry-run --remote
```

**Review the output and all ordered SQL in `supabase/migrations/` before applying.** The project was previously reported empty, but verify it is still the correct project, with no live customer data or unexpected migrations. Only once that is confirmed:

```powershell
npx --yes supabase db push --remote
npx --yes supabase migration list --remote
```

Do not run `supabase db reset --remote`. Afterward use Supabase SQL editor / CLI to verify tables, RLS, function EXECUTE grants, ownership boundaries and migration ledger. Run the Supabase Security Advisor; verify no anonymous or unpaid account can read premium/private data. An empty project does **not** automatically gain news or history data from the old instance.

## 4. Configure backend-only secrets and deploy Edge Functions

Supabase dashboard → project `sqxnulqhmykvlgxxvhmt` → Edge Functions → Secrets. Use server-only secrets; never paste them into this chat or commit them:

```
GEMINI_API_KEY                 required for hosted AI
GEMINI_MODEL                   optional; supported model for your Gemini account
STRIPE_SECRET_KEY              required; sk_test_... ONLY
STRIPE_MONTHLY_PRICE_ID        required; TEST-mode recurring USD $1,050 monthly
STRIPE_TRIAL_SETUP_PRICE_ID    required; TEST-mode one-time USD $99
STRIPE_WEBHOOK_SECRET          required; TEST-mode endpoint signing secret whsec_...
FRONTEND_URL                   required; exact https://YOUR-SITE.netlify.app origin
BILLING_ENABLED                false while setting up; enable in the test environment only after preflight
FRED_API_KEY                   optional where available
NEWS_CONTEXT_WORKER_TOKEN     optional for dedicated news context worker
NEWS_TRANSLATION_WORKER_TOKEN optional for translation worker
```

Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-side bindings; verify their availability in the functions runtime. Keep the service-role value strictly backend-only. Additional optional news/data provider secrets are documented in `backend.env.example` and feature files.

Deploy Edge Functions from the project root after migrations and secrets are reviewed:

```powershell
Get-ChildItem .\supabase\functions -Directory |
  Where-Object { $_.Name -ne "_shared" } |
  ForEach-Object {
    npx --yes supabase functions deploy $_.Name --project-ref sqxnulqhmykvlgxxvhmt
    if ($LASTEXITCODE -ne 0) { throw "Deployment failed: $($_.Name)" }
  }
npx --yes supabase functions list --project-ref sqxnulqhmykvlgxxvhmt
```

Review the `verify_jwt` settings in `supabase/config.toml`. A JWT-exempt function is **not necessarily public**: sensitive handlers must enforce authorization internally. Protect worker secrets and rate limits. The crawler and optional speech/translation workers need a separate long-running host; Netlify static hosting won't run them.

## 5. Configure Supabase Auth

In Supabase Authentication → Providers, enable Email and (optionally) Google. Enable confirmation emails and use production-ready SMTP before customer launch.

Under Authentication → URL Configuration:
- Site URL: your actual HTTPS Netlify/custom-domain origin.
- Redirect URLs: allow the exact HTTPS `/account` and `/reset-password` routes and the corresponding local `http://localhost:8080` paths for development.
- For Google, configure Google Cloud OAuth and the Supabase callback: `https://sqxnulqhmykvlgxxvhmt.supabase.co/auth/v1/callback`.

Verify sign-up, confirmation, login, refresh, password recovery and logout. Users without a valid subscription should have Account access but must NOT get premium API or SQL access.

## 6. Set up Stripe in TEST mode ONLY

In the Stripe Dashboard, turn **Test mode ON**. Create two test prices matching the *existing release offer* (confirm the commercial offer before launching any real billing):
- One-time introductory price: **$99 USD** (99.00; `STRIPE_TRIAL_SETUP_PRICE_ID`).
- Recurring subscription: **$1,050 USD per month** (`STRIPE_MONTHLY_PRICE_ID`), starting after seven days.

The code checks both exact price amounts and types; it will reject mismatched products. Use **`sk_test_`**, never `sk_live_`. This handoff also rejects webhook events marked `livemode:true`.

Stripe Dashboard → Developers → Webhooks (in test mode), add:

`https://sqxnulqhmykvlgxxvhmt.supabase.co/functions/v1/stripe-webhook`

Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. Copy the TEST endpoint signing secret to Supabase Secrets as `STRIPE_WEBHOOK_SECRET`. Configure the Stripe test Billing Portal.

After your HTTPS frontend, migration, endpoints, keys and webhook are confirmed in the isolated test environment, set `BILLING_ENABLED=true` **there only**, then test: checkout → signed webhook → account entitlement → dashboard access → portal → cancel → access revocation. Replay a webhook to test idempotency and inspect a second unpaid account to verify tenant isolation. **Do not activate live mode** from this bundle.

## 7. Deploy the frontend to Netlify (preferred) or Vercel

Netlify → Add new site → Import from GitHub or deploy from this source. Vite settings:
- Build command: `npm run build:netlify`
- Publish directory: `dist`
- Node version: 22+ (use provider settings)
- Environment variables: the same 3 public `VITE_SUPABASE_*` values as `.env.local`.
- `netlify.toml` handles SPA routing; confirm direct `/login`, `/account`, `/simulations` links refresh successfully.

Alternatively use Vercel with `npm run build:vercel`, output `dist` and existing `vercel.json`. Netlify and Vercel are alternatives; **do not deploy both unless needed**.

Set Supabase Auth Site URL + allowed redirects and backend `FRONTEND_URL` to the actual HTTPS domain. Test the custom domain and HTTPS separately after DNS propagation.

## 8. Go/no-go checklist

- [ ] Local lint, type check, tests, migration checks and production build passed
- [ ] Supabase project `sqxnulqhmykvlgxxvhmt` linked, SQL applied, advisors passed
- [ ] Every Edge Function deployed with its required direct provider credentials and correct permissions
- [ ] Email sign-up, OAuth (if enabled), session and password recovery work
- [ ] Stripe uses only sk_test_ key, test prices and test webhook; repeated webhooks are harmless
- [ ] Unpaid user cannot access premium data/API; paid user can only access owned data
- [ ] Simulator gives a real result from the actual configured backend, never a silent preloaded demo
- [ ] News data and external workers are deployed separately where required
- [ ] Netlify HTTPS site and all SPA deep links load without redirect/CORS issues
- [ ] Source licensing and market-news freshness are checked before customer claims

**Never present the ZIP alone as proof of a live, secure or payment-tested deployment.**
