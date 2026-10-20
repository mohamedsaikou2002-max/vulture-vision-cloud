# Publish audit and deployment status

## Implemented

- Quantum/IBM UI, score calculations, billing helpers and provider functions are absent.
- Runtime metadata collection includes all 207 additional catalog entries plus the
  original 80 enabled publishers. Bounded concurrency, robots, public-address and
  redirect checks remain. Scheduled collection isolates failing publishers.
- Source heartbeat migration adds authenticated reads and server-only writes.
  The news page displays per-source reports, pages the complete recent index,
  preserves loaded pages on refresh, and exposes returned RSS headlines through
  “Show more”. Unknown publication times are explicit.
- Indexed news is visible in the simulator. Selecting an article carries its ID
  and headline into the scenario; no headline automatically purchases a run.
- Indexed news supplies an intel digest when the optional external brief service
  is absent. This digest does not invent confidence or transition probabilities.
- Socioeconomics uses dated world-state observations when its optional external
  service is absent. Missing dimensions display dashes. Model dimensions are
  explicitly derived, not measured psychological states.
- Market reads have Yahoo host fallback, equity CSV fallback, crypto history
  fallback, and public FRED CSV fallback. Missing quote fields remain null rather
  than becoming zero. AI uses the existing bounded credential failover transport.
- whisper.cpp is cloned and pinned; whisper-server and whisper-cli compile on
  CPU. The authenticated WAV gateway and browser capture/VAD are integrated.
  Hands-free recording pauses during runs, pending requests and spoken replies.
  Without a configured voice host, the UI names browser speech as its fallback.

## Actual external results

The explicit full catalog sweep attempted 207/207 sources. Every source failed
public DNS resolution (`gaierror: Temporary failure in name resolution`). Zero
articles were collected; nothing was uploaded. Raw diagnostics are in the cloud
workspace at `/workspace/audit-latest/news-207-run.json`.

The hosted news function returned HTTP 200 and 80 aggregated headlines in the
pre-deployment probe. Its authenticated publisher desk requires a real member
session. CoinGecko returned live quotes. Analytics rejected the anonymous probe
with 401, as expected. The old localhost intel/socio services were absent; code
now has Supabase-backed fallback paths. Bybit returned 403. Yahoo and the official
Whisper model host were blocked by the cloud egress proxy. New market fallbacks
are tested with provider fixtures; this does not establish live reachability.

The native speech build succeeded. Gateway HTTP smoke checks return unavailable
while the model engine is absent, and unauthenticated transcription returns 401.
Speech inference with a real model is **not verified**: the official model
could not be downloaded. No fabricated transcripts were used as live proof.

## Required before publishing

1. Activate the saved cloud network configuration, or deploy on a host with
   public publisher DNS and access to Yahoo, FRED and the official model host.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
   `NEWS_CONTEXT_WORKER_TOKEN` securely on the collector host. No service-role or
   provider credential belongs in VITE variables.
3. Apply the additive source heartbeat migration via the existing release process.
   Deploy the changed news, analytics and AutoSim functions. Remove any old hosted
   quantum functions separately; deleting repository source does not delete a
   previously deployed function. Existing ledgers/records have not been erased.
4. Download a real Whisper model; deploy private whisper-server and the
   authenticated gateway behind HTTPS. Set public Supabase configuration and
   exact `VOICE_ALLOWED_ORIGINS`; set frontend `VITE_VOICE_HOST` to the gateway.
   Enforce ingress body/time/rate limits. See `deployment/whisper/README.md`.
5. Start the supervised collector/context worker. Verify successful article and
   heartbeat writes, fresh news on the frontend and selected IDs in a simulator
   request. A failed source remains a failed source; collection cannot guarantee
   all possible news or bypass publisher access restrictions.
6. Use an authorized member/operator session to verify intel, analytics, world
   state, an actual AutoSim run, recovery/history and microphone transcription.
   Verify provider quotas and accepted schema. The MiroFish pilot still needs its
   protected external engine and credentials; its permissions remain unchanged.

Staged billing/checkout stays inactive. These code changes and local checks do
not establish that the hosted app is ready to publish.
