# Simulator provider recovery

The missing-observation warning was caused by an incorrect FRED public CSV path:
`/graph/graph.csv` returned 404. The backend now uses
`/graph/fredgraph.csv`, with the existing API-key path and freshness validation.

Live retrieval in this task succeeded for spread, volatility, yield curve,
unemployment, inflation, financial conditions and retail sales. Michigan
sentiment was dated August 1 and failed the unchanged 70-day freshness rule.
A fresh OECD US composite consumer-confidence series (`USACSCICP02STSAM`,
September 1) now supplies an explicitly attributed confidence proxy when Michigan
is unavailable. Its percentage balance is normalized over -100 to +100, rather
than using Michigan's index scale. These are model dimensions, not measurements
of people's trust. Engine version 1.3.0 prevents variants from silently mixing
old and new baseline definitions.

The actual no-key FRED retrieval plus baseline calculation returned an empty
neutral-dimension list. Stale/missing inputs still produce explicit defaults if
both primary and fallback are unavailable. No warning was hidden.

Gemini now defaults to `gemini-2.5-flash`, with the existing bounded 404 model
fallback and 429 credential failover. Structured JSON calls on 2.5 Flash disable
thinking so their output budgets cover the returned JSON. Interpretation has a
25-second budget; explanation has 35 seconds. Neither a network failure nor a
credential rejection is mislabeled as a timeout. Credential/model-access errors
are sanitized and actionable. Ambiguous inference failures are not retried.

Deploy `vv-autosim` to apply these fixes to new runs. Existing saved warnings are
historical and do not disappear; create a new baseline after deployment. Shared
Gemini fixes also take effect in other consumers when those functions are
redeployed. If the hosted `GEMINI_MODEL` explicitly overrides the default, choose
a model the configured key can access; the code does not overwrite that secret.
No real Gemini inference could be verified in the task because hosted provider
credentials and an authorized live member session are not available here.
