# Trade Lab MVP

Route: /trade-lab. Depends on the production-audit branch / PR #2.

## Implemented
- Long, short and abstention hypotheses with entry, stop, target, size, point value, equity, loss/exposure limits, costs, session, rationale and invalidation.
- Deterministic arithmetic for linear USD-settled instruments, contract multipliers, execution-cost assumptions, gap-through-stop exits and conservative ambiguous OHLC handling.
- Synthetic contradictory stresses, 5/10/15 fixed-size losing streaks, half-size and no-trade comparisons. Unsupported correlation, regime and overfitting tests explicitly require data.
- User-uploaded chronological OHLCV CSV practice. Decisions freeze before later candles appear; AI sees only the decision cutoff. Same-bar stop and target use stop first; target touch assumes a fill. These assumptions must be revisited for real execution research.
- Bull, bear, contrarian, macro, risk and execution Gemini reviewers share the same frozen snapshot. Confidence is withheld. Reviewers cannot populate computed performance fields. Partial reviewer failure remains visible.
- Historical news lookup requires a version created before the visible decision timestamp and still valid at that timestamp. No current-news substitution for missing archived news. News updates mark earlier reviews stale; a new review is user-triggered and subject to quotas.
- Ten fundamentals lessons, quiz assessments and practical replay prompts; targeted topics based on cost/risk/ambiguity outcomes. Quiz state is currently session-only.
- Owner-isolated cloud practice journal, CSV hash and engine-version provenance. Results are client-computed / user-uploaded, explicitly unverified. This journal is not a broker ledger or proof of an edge.

## Deployment
Apply 20261013190000_trade_lab_journal.sql using the project's migration workflow after review, then deploy vv-trade-analysis. Requires existing Gemini server secret, operator allowlist and claim_scenario_synthesis RPC. This endpoint shares the existing six-analysis-per-user-per-hour quota; one analysis uses up to six bounded reviewer requests. No provider calls were executed during development.

## Data contract
CSV header: timestamp,open,high,low,close,volume. ISO timestamps must carry a timezone and increase strictly. At most 5,000 candles and 1.5 MB. Supply the correct instrument's dataset, quantity and USD point value; data provenance is not independently verified. The future dataset is held in browser memory, so this is practice concealment, not tamper-proof blind evaluation.

## Pending production research capabilities
Licensed historical/live providers, charting, economic-calendar ingestion, independently held-out datasets, server-owned immutable strategy/run records, walk-forward/purged validation, portfolio correlation, Monte Carlo/bootstrap diagnostics, calibrated confidence, options/margin/liquidation, cumulative paper-account and daily-loss accounting, durable competency tracking, richer adaptive tutoring, MiroFish behavioral-agent coupling and broker integration remain separate stages. Current hypothetical stress coefficients are explicit teaching assumptions and are not estimated market distributions. No synthetic test claims historical performance.

The 90-day pathway is illustrative. No profit deadline, risk-of-ruin probability, validated edge or annualized performance ratio is inferred from these practice cases.
