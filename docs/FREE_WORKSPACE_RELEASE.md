# Public workspace deployment — no sign-in

The owner explicitly removed account login, anonymous Auth, Stripe billing, and app-level per-user research quotas. No Supabase Auth provider needs to be enabled.

The browser uses only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. It neither calls getSession/signInAnonymously nor stores or refreshes a user session. Public news metadata and new simulation history are read directly through Supabase with the publishable key. AI calls go through public Edge functions so provider and service-role credentials stay server-side.

New scenarios/results are intentionally shared in public_workspace_jobs and labeled public in both simulators. Existing private autosim_jobs and prior customer/billing records are not made public. Browser requests cannot forge simulation results or mutate server tables. Input limits, numerical workload limits, provider quotas, worker-token checks and operator-only trading/admin controls remain; these are not sign-in requirements for normal workspace use.

## Deployment

1. Inspect the remote migration ledger, then deploy the outstanding ordered migrations, including `20261026000000_free_workspace.sql` and `20261026010000_public_workspace.sql`. Do not reapply recorded migrations. The latter creates separate public research storage, an atomic server-only claim RPC without a daily quota, and public SELECT policies for news, source health and global news context. It does not disable RLS globally or expose prior private research.
2. Deploy the updated public functions and their config.toml entries: vv-news, vv-analytics, vv-market, vv-regime, vv-chat, vv-intel-brief, vv-autosim and vv-simulation-chat. JWT verification is disabled only for these public workspace functions. Their handlers no longer require an account/session or payment entitlement.
3. Deploy retired vv-billing/stripe-webhook endpoints (HTTP 410, no provider/database writes) and remove the old webhook destination and obsolete Stripe billing secrets from secure configuration. Repository changes do not cancel any subscriptions that might already exist in Stripe; reconcile those separately in that account.
4. Deploy the voice gateway update. It accepts bounded audio without Supabase Auth; engine health no longer depends on Supabase secrets. Supply the actual Whisper model and inference host. Keep whisper-server itself private behind the gateway.
5. Publish the frontend from this revision. No anonymous sign-in setting or service-role key is required by the browser. Server functions still need their project-managed Supabase service configuration and AI/data provider secrets.
6. Test in a clean browser with Supabase Auth disabled: all workspace routes, live Intel/research responses, Nasdaq scenarios/replay/questions, shared history, news/translation display, analytics refresh and voice. Confirm zero /auth/v1 calls and zero billing calls. Confirm that the anon database role can SELECT new public history/news, cannot SELECT historical private research/billing, and cannot INSERT/UPDATE results or run service-only RPCs.

Local fixtures and migration checks validate the no-auth path. The live hosted Auth/Edge/database configuration cannot be deployed or inspected through a management connection in this environment, so hosted behavior remains pending deployment and live verification. The model download/voice-host limitation is independent of login removal.
