# Forecast corpus and calibration contract (v1)

This document describes the v1 data contract added by
`20261011000100_forecast_corpus.sql`. It is the storage and evaluation
foundation; it does not yet make the existing simulation UI produce a
calibrated financial forecast.

## Forecast target

The migration registers two versioned, 20-trading-session targets. Every
`corpus_snapshot` is for one instrument and one as-of timestamp:

- `asset_20_session_log_return@1`: `ln(total_return_index[t+20] /
  total_return_index[t])`.
- `asset_20_session_10pct_loss@1`: event indicator for
  `min(total_return_index[t+k] / total_return_index[t] - 1) <= -0.10`,
  for `k=1..20`.

Use a total-return series with a documented corporate-action treatment. A
label is not available until all 20 future sessions have elapsed. Keep the
target definition/version fixed for a run; if the threshold or calculation
changes, add a new target version rather than rewriting past outcomes.

These definitions are examples, not claims that a 20-session 10% loss can be
forecast reliably. The event is rare, so report event counts and wide
uncertainty. Evaluate continuous returns and event probabilities separately.

## Observation and snapshot contract

1. **Capture observations, not just current values.** Each
   `corpus_observations` row records the series/instrument, observation time,
   first availability time, optional vintage time, unit, source, and value.
   Never backfill `available_at` with the observation date unless the value
   really was published then.
2. **Build a snapshot strictly as of its cutoff.** Only use observations with
   `available_at <= as_of`; when a series has revisions, select the vintage
   that was available at that cutoff. Persist a feature schema version and a
   provenance manifest containing source IDs, source vintage/release dates,
   transformation names, and missing-value handling.
3. **Keep the feature vector numeric and typed by convention.** A v1 feature
   schema should document units and transformations for: lagged total returns,
   realized volatility, drawdown, cross-asset correlation, market breadth,
   rates/curve changes, credit spreads, and liquidity/funding proxies. Include
   missingness flags; do not silently replace unknown inputs with zero.
4. **Attach labels later.** Insert `corpus_outcomes` only when the full target
   window has matured. Preserve the label formula/version and the source used
   to compute it. Do not include future article text, revised values, or
   future regime labels in the snapshot.

The existing migrations and simulation page do not yet define this point-in-time
data contract. The Socio-economic corpus passed to the simulation is context,
not a labeled calibration dataset.

## Forecast equation

For the binary target, a small, inspectable baseline is a regime mixture of
regularized logistic models:

```
p_crash = sum_z P(Z_t = z | X_t) *
          sigmoid(alpha_z + beta_z' X_t + gamma' S_t)
```

- `X_t`: the saved, point-in-time feature vector.
- `Z_t`: regime probabilities computed from data available at `t`.
- `S_t`: explicit scenario variables (shock type, affected instruments,
  magnitude range, duration), validated and versioned separately from prose.
- `p_crash`: probability of the registered event target over its stated
  horizon.

Use shrinkage/regularization because the number of independent crises is
small. For continuous returns, store a predictive distribution and score the
whole distribution; a Student-t distribution is a reasonable tail-aware
baseline to compare against a Gaussian. Do not add Hawkes contagion or a
generalized Pareto tail model until timestamps, event definitions, and enough
tail observations exist to validate them.

MiroFish seed runs estimate simulation variability conditional on one
scenario. Save the seeds and each draw for reproducibility, but do not count
200 seeds as 200 historical events or independent forecast labels. Initially
treat summaries such as simulated sentiment, dispersion, or simulated
drawdown as candidate features. They earn weight only if walk-forward results
show improvement over a historical/regime baseline.

## Leakage-safe evaluation and calibration

- Use chronological rolling-origin evaluation. At each origin, fit only on
  labels whose `outcome_available_at` is before the origin and features
  available by each sample's own cutoff.
- For a 20-session target, purge training samples whose label horizon overlaps
  the test interval; use a post-test embargo at least as long as the horizon
  when applicable. Do not randomly split daily market rows.
- Fit Platt/logistic calibration on earlier out-of-fold forecasts only, then
  evaluate on a later untouched period. Isotonic regression can overfit when
  there are few rare positive events; require a minimum event count or prefer
  the simpler calibrator.
- Log each live prediction before its outcome occurs. Keep model, feature
  schema, data vintage, target, calibrator, scenario, raw distribution, and
  calibrated output immutable.
- Compare against simple baselines: historical target frequency, regime-only
  probability, and a market-volatility baseline. Report sample count,
  positive count, Brier score, log loss, and reliability bins. For continuous
  distributions, report CRPS and interval coverage/width. A score without a
  baseline, date range, and count can be misleading.
- Historical crisis replays are useful diagnostics but are not clean proof:
  model pretraining can contain the event and its resolution. Anonymizing a
  replay may reduce direct cues but cannot prove the model forgot the event.
  Treat timestamped live forecasts as the strongest evidence.

Binary scores are computed from probability `p_i` and realized event
`y_i ∈ {0,1}`:

```
Brier = mean((p_i - y_i)^2)
LogLoss = -mean(y_i * log(p_i) + (1-y_i) * log(1-p_i))
```

Clip probabilities only for numerical stability during log-loss calculation,
and record the clipping rule. CRPS is for the continuous predictive
distribution and realized value. Proper scoring rules evaluate both
calibration and sharpness; always pair them with reliability plots and
baselines.

## Access, licensing, and retention

Raw source observations, feature snapshots, and labels have no client-role
read/write grants in the migration. Ingestion, forecast creation, and scoring
must be performed by an authenticated server-side path using the service role;
that path must derive `owner_id` from the verified auth token, never from a
request field. Signed-in users can read only their own forecast runs, draws,
and scores. Never put a service-role key in a Vite `VITE_*` variable.

Before ingesting any provider or article corpus, record its license/terms,
attribution, retrieval time, and whether point-in-time history is available.
Do not ingest data that the product is not licensed to store or redistribute.
Use source identifiers/hashes rather than copying private or user-specific data
into public examples.

## Next implementation steps

1. Add a server-side ingestion job that writes source metadata/observations,
   builds snapshots from the as-of query, and labels matured windows.
2. Add an authenticated server-side forecast endpoint. It validates the
   target/scenario, runs the model and MiroFish adapter, writes the immutable
   forecast plus draws, and returns the stored run ID.
3. Add an outcome-scoring job that joins matured labels to forecasts and
   records Brier/log loss/CRPS by model and target version.
4. Connect the UI to persisted run IDs and display distributions, forecast
   time, horizon, data cutoff, calibration state, and uncertainty.
5. Add automated migration/RLS tests and CI before enabling writes or deploying.

The current client directly calls the MiroFish host. This schema should not be
treated as production-ready until that call path is moved behind the
authenticated server endpoint and the RLS contract is tested.
