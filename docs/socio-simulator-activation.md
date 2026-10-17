# Vulture Vision socioeconomic simulators: activation

## Immediately available in the app
Open the **SOCIO-ECONOMICS** navigation tab. The **Local Scenario Lab** is a working deterministic exploratory engine, independent of APIs. Choose credit, supply, demand, policy sliders or a preset; observe synthetic 0–1 stress indices. This is a manually specified illustrative model, not data-driven market prediction, investment advice or an empirical Monte Carlo. Unit tests: \`src/test/localSocioScenario.test.ts\`.

The default remote socioeconomic endpoint is intentionally **unconfigured**; visitors' \`localhost\` is not probed. If you operate a compatible remote numerical backend, set \`VITE_SOCIO_BASE_URL=https://<your-authorized-service>\` at build time. It must implement \`/api/socioeconomics/health\` and \`/api/socioeconomics/full\` and supply provenance. Remote API status remains separate from local-lab readiness.

## Multi-agent socio-economic MiroFish engine
The separate **SIMULATIONS** tab provides multi-agent workflow but requires an authorized private service. It deliberately blocks Start until the backend is healthy and authenticated.
1. Provision a private Azure host with HTTPS and a supervised process.
2. Checkout pinned MiroFish commit from \`deployment/mirofish/UPSTREAM_REF\`; apply \`deployment/mirofish/gateway.patch\` and, if needed, \`gemini-provider.patch\`. See \`deployment/mirofish/README.md\`.
3. Set backend-only LLM/Gemini and Zep credentials, \`MIROFISH_GATEWAY_TOKEN\`, and enforce gateway authorization.
4. Set Supabase function secrets \`MIROFISH_URL\`, \`MIROFISH_GATEWAY_TOKEN\`, and operator UUIDs \`MIROFISH_ALLOWED_USER_IDS\`, then deploy \`vv-simulation\`.
5. Apply SQL migrations and deploy \`vv-news\`, \`vv-news-context\` and required worker services for current-event source context. Run a continuously supervised ingestion worker, configured to respect source permissions.
6. Verify authorized health, one bounded test run, job restart/recovery and report generation, with provider costs visible before broad customer enablement.
7. Operator-only controls must remain until per-user job ownership, persistent quotas, budget checks and idempotent mutation requests exist. Never expose the engine's token to browsers.

**This package does not deploy or activate cloud resources.** Credentials, permissioned APIs, Azure hosting and live provider validation are external prerequisites. If any are missing, the UI must say so and still allow the local numerical scenario lab.
