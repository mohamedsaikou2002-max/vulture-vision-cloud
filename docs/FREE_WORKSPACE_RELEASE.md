# Free workspace deployment

The owner has removed the subscription offer, checkout, customer portal and frontend authentication gate. Every workspace route renders without login. Existing public landing visuals remain, with the offer replaced by a direct Open workspace action.

Backend requests automatically establish a Supabase anonymous Auth session. This is a private browser identity, not a login/paywall. Existing account sessions are reused. Saved research is still own-user-only; operator allowlists, server-only worker tokens, input validation and resource quotas remain. Clearing browser storage can lose access to guest history.

## Required deployment

1. Enable **Authentication → Sign In / Providers → Anonymous Sign-Ins** in the connected Supabase project. A live check currently returns `anonymous_provider_disabled`; secure project management access is unavailable in this workspace. Configure the project's supported abuse/rate controls. Do not disable RLS or expose a service key as a substitute.
2. Inspect the remote migration ledger and deploy the new ordered migration `20261026000000_free_workspace.sql` once. It removes payment dependence from workspace identity checks. It retains historical billing records and private ownership/operator policies. Do not replay old migrations.
3. Deploy the updated Edge functions, including the retired `vv-billing` and `stripe-webhook` endpoints. They return HTTP 410 and never call Stripe or write subscription state. Leaving old deployed functions active would retain the old behavior.
4. Deploy the updated voice gateway; it verifies identity without calling billing. Whisper still requires a real model and inference host.
5. Publish the frontend from this revision. Anonymous visitors should navigate immediately. AI, data and saved-research operations need the anonymous Auth setting and migration above; they show a configuration error until these are deployed.
6. Remove the old webhook destination and obsolete Stripe billing secrets from the deployment's secure configuration after the retired functions are deployed. Repository changes do not cancel any subscriptions that might already exist in the external Stripe account; reconcile those in Stripe separately.
7. Verify fresh-browser guest creation, two-browser research isolation, existing-user session reuse, no checkout/portal calls, retired endpoints, real AI/news/simulations and voice. No Stripe key is required for the new app.

Changes are prepared in the repository. No hosted migration, Auth setting, Edge deployment or external subscription cancellation was performed from this environment.
