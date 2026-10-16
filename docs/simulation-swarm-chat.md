# Vulture Vision · Simulation Swarm Chat (Belicia PodRoom adaptation)

**Scope:** simulation interpretation and research, not autonomous trading or influence operations.

## Source patterns
Adapted from the user's Belicia GitHub project:
- \`src/pages/PodRoom.tsx\`: a PodRoom-style roster, question area, per-agent replies, scenario-state sidebar.
- \`src/lib/podApi.ts\`: modelled-agent interrogation and context-bearing conversations.
- \`supabase/functions/pod-room/index.ts\`: server-only Gemini generation.

The adaptation uses Vulture Vision's existing scenario inputs, news snapshots, MiroFish run status and optional generated report. It does **not** reuse Belicia's unrelated persuasion model or claim that role cards are real MiroFish agents.

## Implementation
- Frontend: \`src/components/SimulationSwarmChat.tsx\` displayed on \`/simulations\`.
- API: \`src/lib/simulationChatApi.ts\` invokes new Supabase Edge Function \`vv-simulation-chat\`.
- Backend: \`supabase/functions/vv-simulation-chat/index.ts\` verifies a Supabase user JWT and makes one Gemini request per analyst response.
- Input/output security: \`supabase/functions/_shared/simulation_chat_contract.ts\` bounds request sizes and validates the returned JSON.
- The role modes are full-panel synthesis, bull, bear, macro, and risk. Gemini creates distinct synthetic perspectives in **one call**. Independent multi-agent modelling is provided only by the separately configured MiroFish engine.
- History: at most four prior user/assistant exchanges are carried into a request. They remain in the browser state and are not written to the database.
- Provider availability: no mocked answers; if Gemini fails or is absent the UI reports an error.
- Source provenance: evidence IDs are filtered against the app-provided news set. These are not independently verified claims. Users should open and cross-check source links from the surrounding Simulations screen.

## Required Supabase setup
1. Apply \`supabase/migrations/20261012034000_scenario_synthesis_quota.sql\` (or ensure its RPC is installed). \`claim_scenario_synthesis(uuid)\` allows up to **six** AI synthesis calls per authenticated user per hour across features using that RPC.
2. Set \`GEMINI_API_KEY\` as a secret in the backend (not a \`VITE_\` variable). Optionally set \`GEMINI_MODEL=gemini-2.5-flash\`.
3. Deploy \`supabase/functions/vv-simulation-chat\`. Leave user-JWT verification and the database quota enabled.
4. Check end-to-end from a signed-in test account. Ask before starting a MiroFish simulation, then after a completed test run with a real report. Ensure the response accurately states whether the engine has produced a report.
5. Inspect billing/quota, 400 invalid payloads, 401 unauthenticated, 429 quota exhaustion, 502 Gemini failures, 503 missing secrets/migrations. Use a test project for provider calls.
6. No live trades or simulation mutations occur through the chat endpoint. It has no IBM Quantum execution or Stripe charge privileges.

## Limits
The backend trusts neither user-supplied news nor simulation reports as external instructions. Chat answers are conditional research hypotheses rather than calibrated probabilities. This PR adds a **real functioning path** to Gemini when configured, but deployment, secret installation and live provider testing must be confirmed separately.
