# Vulture Vision / MiroFish pilot

The React simulation page now uses MiroFish's real ontology → graph → prepare → start → run-status workflow through the `vv-simulation` Supabase function. Analysis reports are generated on demand, after a completed run. The 47 uploaded historical events are bundled as read-only qualitative seed context. Outcome magnitudes and later policy responses are excluded from seeds. This is exploratory simulation, not calibrated market prediction.

## Engine setup

From the Vulture Vision repository root, on the backend host:

```bash
# Python 3.11 or 3.12 and uv are required.
git clone https://github.com/666ghj/MiroFish.git ../MiroFish
cd ../MiroFish
git checkout "$(cat ../vulture-vision-cloud/deployment/mirofish/UPSTREAM_REF)"
git apply ../vulture-vision-cloud/deployment/mirofish/gateway.patch
cp .env.example .env
```

Edit MiroFish/.env securely on the backend host:

```dotenv
LLM_API_KEY=<OpenAI-compatible-provider-key>
LLM_BASE_URL=<provider-API-base-URL>
LLM_MODEL_NAME=<supported-model>
ZEP_API_KEY=<Zep-Cloud-key>
VULTURE_GATEWAY_REQUIRED=true
MIROFISH_GATEWAY_TOKEN=<random-long-server-only-token>
FLASK_HOST=127.0.0.1
FLASK_DEBUG=false
```

Remove the optional LLM_BOOST_* placeholders unless using that feature. Do not commit .env. Do not place any provider or gateway token in a VITE variable.

```bash
cd backend
uv sync
uv run python run.py
```

`uv sync` succeeded in this workspace with Python 3.12. It pulls substantial PyTorch/CUDA dependencies. Confirm host disk/RAM capacity. Vulture Vision replaces the upstream Vue frontend, so its Node/frontend setup is unnecessary for this integration.

Run one backend instance for the pilot: tasks and build progress are held in process memory. Persist backend/uploads, including generated agent configs and simulation files. Put the backend behind HTTPS and a supervised process; do not expose the unmodified unauthenticated engine. Preserve the gateway patch on upgrades. The included run.py server is suitable for a local smoke run; review a supervised production server/process design before public launch, accounting for its subprocess cleanup behavior.

## Supabase gateway setup

Set these server-side secrets in the Vulture Vision Supabase project:

- MIROFISH_URL: HTTPS origin of the protected engine, without a path.
- MIROFISH_GATEWAY_TOKEN: same random token as the engine.
- MIROFISH_ALLOWED_USER_IDS: comma-separated pilot operator Supabase user UUIDs.

Deploy:

```bash
supabase functions deploy vv-simulation
```

The gateway validates the Supabase user and denies all users outside the operator allowlist. It forwards only enumerated operations and caps start requests at 24 rounds. Its health check also requires operator access. It deliberately does not expose upstream project lists, deletion, arbitrary paths or an anonymous engine health proxy.

This is an operator pilot, not multi-tenant SaaS. Before broader access, add server-enforced job ownership, persistent quotas, budget ceilings, idempotent start handling, and durable orchestration. Requests rejected by the allowlist show unavailable/pilot-access messaging. Preparation may continue on the server after monitoring is stopped; the UI says so. Running simulations use the real stop endpoint, with a second stop attempt after any late start response. Navigating away stops monitoring, not the server run. A lost start response may require operator inspection in MiroFish.

## Verification

Completed: dependency installation, frontend typecheck/build, workflow contract tests, outcome-field exclusion tests, graph-failure test, backend gateway 401/200 smoke test. Live provider runs require LLM and Zep credentials, which were not supplied. No deployment or paid simulation was executed.

Upstream MiroFish is AGPL-3.0; its license is preserved in UPSTREAM-LICENSE. Retain notices and review its source-disclosure requirements before hosting a modified engine. No alternative commercial license is assumed.

## Remaining production work

The audit's existing broad RLS policies and privileged handlers still need remediation. This gateway's operator restriction does not fix unrelated endpoints. The upstream graph controls actual agent population; the previous unsupported arbitrary agent slider has been removed. Historical prices, controls and timelines are not included in the supplied CSV. Confidence calibration and multi-seed market distributions are not implemented. API quotas, true replay anonymization and leakage measurement remain separate work.
