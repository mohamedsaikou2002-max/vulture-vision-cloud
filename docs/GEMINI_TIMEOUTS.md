# Simulation AI timeout repair

The displayed warnings mean interpretation/explanation did not complete. Numerical scenarios still run, with explicitly labeled keyword shocks and missing AI commentary. Do not remove those warnings or label keyword interpretation as a successful AI answer.

Changes:

- Default Gemini candidates use `gemini-2.5-flash` and `gemini-2.5-flash-lite`, avoiding speculative version probes. An explicitly configured model remains first; another model is attempted only after HTTP 404.
- AutoSim defaults to Flash Lite for both native Gemini and the Lovable gateway, caps each structured answer at 1,200 output tokens, and limits explanation context to eight bounded headlines.
- Interpretation has a 30-second deadline; explanation has 40 seconds. Native structured Flash requests disable extra thinking. Calls stay bounded rather than waiting indefinitely.
- The gateway distinguishes connection failure, request timeout, response-body timeout and malformed JSON. Timeout/connection failures do not launch another inference or rotate credentials. Numbered native keys still rotate only on HTTP 429 and honor Retry-After.
- Numerical calculations, atomic job claims, replay protection and honest fallback warnings remain intact.

Server-only optional settings:

| Scope | Native Gemini | Lovable gateway |
|---|---|---|
| Simulation override | `GEMINI_AUTOSIM_MODEL` | `LOVABLE_AUTOSIM_MODEL` |
| Existing global override | `GEMINI_MODEL` | `LOVABLE_AI_MODEL` |
| AutoSim default | `gemini-2.5-flash-lite` | `google/gemini-2.5-flash-lite` |
| Credential | `GEMINI_API_KEY` and numbered slots | `LOVABLE_API_KEY` |

Simulation override takes priority over the global override. Credentials remain managed secrets, never frontend variables. If both provider credentials are present, the existing native-Gemini preference remains; an ambiguous paid failure does not automatically switch providers.

Deploy the updated `vv-autosim` bundle in the connected Supabase/Lovable project. Other functions sharing the adapter (`vv-chat`, `vv-simulation-chat`, `vv-analytics`, `vv-intel-brief`, `vv-scenario-brief`, `vv-news-context`, `vv-news-translate`) need redeployment to adopt its default model and error-classification updates. Check any explicit hosted model override: a retired, inaccessible or slow model can still fail despite corrected defaults.

Run an authenticated hosted scenario with the actual configured provider. Verify interpretation and explanation are present, inspect request duration and actual model access, then test quota and delayed-response behavior. A local fixture pass does not establish that hosted credentials, provider billing or connectivity work. If inference still times out, inspect provider-side metrics and the deployed override rather than repeatedly submitting a new paid job.

Stripe activation was stopped. This repair does not change Stripe configuration or production membership enforcement.
