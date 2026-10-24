# Vulture Vision · research-grounded swarm interoperability

## What this changes (implemented)

Vulture Vision has **two different agent-like paths**:

1. `vv-simulation-chat` calls one Gemini model to synthesize bull / bear / macro / risk perspectives. They are synthetic analyst **roles**, not independently executing LLM agents.
2. The remote MiroFish simulator can execute a separate multi-agent run when configured; its successful deployment and independent behaviors are not inferred from a chat reply.

The implementation adds typed claim nodes and citation edges in `_shared/swarm_interoperability.ts`, extends the shared chat contract to request each role's **assumptions**, **invalidators** and **news source IDs**, and displays citation coverage in the research room. The existing Edge Function resolves supplied news IDs against the server database before generation. Parsed role-level IDs must belong to this resolved set; otherwise they are removed. Responses lacking the new optional fields remain parseable; their claims are explicitly shown as unlinked. Citation linkage measures structure only, not truth or causal entailment.

The **current-event** scenario seed and evaluation requirement now include heterogeneity, explicit semantic dependencies, competing interpretations and bounded sensitivity-test guidelines for the separate MiroFish path. That is an engine prompt enhancement, not a new population model, protocol implementation, or differentiable optimizer.

### Graph contract

```text
vv.swarm.semantic.v1
claims: role => position, assumptions[], invalidators[], evidence_ids[]
sources: server-resolved news IDs actually cited
edges: claim:<role> --cites--> source:<id>
verification: structure_and_source_ids_only
limitations: no source available, unlinked claims, and no proof that a citation supports its claim
```

The graph is bounded to four unique roles and eight candidate news items. Source edges never imply validated causality, accurate reporting, or calibrated probability. Contradictions in language are surfaced as modeled disagreements, not automatically resolved. Never convert a role claim into an actual trade or order.

## Paper-to-feature mapping

| Research | Correct attribution | VV application | Status |
| --- | --- | --- | --- |
| *Towards a Formal Theory of Interoperability* (2010), [ODU dissertation](https://digitalcommons.odu.edu/msve_etds/27/), DOI 10.25777/tk13-2064 | Saikou Y. Diallo | Typed messages, dependency mapping, explicit difference between exchanging tokens and using information | Partial implementation; formal proofs not reproduced |
| *On the Complexity of Interoperability* (2016), DOI 10.22360/SpringSim.2016.MSCIAASSPACE.014 | Saikou Y. Diallo | Bound the mapping problem; reject unbounded recursive semantic translation | Design reference, not a runtime theorem |
| *How to Create Empathy and Understanding: Narrative Analytics in Agent-Based Modeling* (2018), DOI 10.1109/WSC.2018.8632267 | Saikou Y. Diallo, C. Lynch, K. Rechowicz, G. Zacharewicz | Heterogeneous synthetic actor narratives and falsifiable human-facing explanations | Seed instructions; not emotion detection |
| *Applicability of Artificial Societies to Evaluate Health Care Policies* (published 2024), DOI 10.1097/SIH.0000000000000718 | A. Tolk, W. Rouse, B. Pires, J. Cline, S. Diallo, S. Russell | Calibrating representative social actor populations with empirical and synthetic data | Design reference; no claim of millions of actors |
| *Differentiable Agent-Based Simulation for Gradient-Guided Simulation-Based Optimization* (2021), DOI 10.1145/3437959.3459261 | **Philipp Andelfinger**, not Diallo | Optimize a differentiable relaxation of scenario parameters with gradient-based methods | Future work; not implemented by this change |

This module is **inspired** by research principles. There is no representation that the named authors contributed code, endorsed VV, or verified its models. Papers and abstracts are research citations; source-text copyright/licensing must be respected if later ingested into a vector index.

## Proposed second-stage engineering (not implemented)

1. **Ontology and agent envelope:** a versioned message `{actor, observed_at, state, hypothesis, action, dependencies, evidence_ids, source_type, uncertainty}`; schema validation, source signatures, TTLs and explicit `unknown` semantics. Translate incompatible role schemas with audited, bounded adapters.
2. **Actual behavioral population:** implement independent stochastic policy functions per actor archetype, separate propensity distributions, resource constraints, network edges and calibration against permitted historical observations. Actor communication and human-facing summaries are not mind-reading.
3. **Semantic verification:** distinguish schema conformance, valid evidence references, factual support, causal support and achieved agreement. Evaluate each separately. Detect feedback cycles, orphan dependencies, propagation of unsupported claims and provider-made citations.
4. **Optimization lab:** run reproducible seeded baseline / adverse / favorable scenarios; optimize a *declared* differentiable surrogate with a library such as JAX or PyTorch, compare it with the original discrete simulator and robust non-gradient baselines. Require objective definitions (drawdown, expected shortfall, liquidity constraints), regularization, parameter bounds and held-out/walk-forward validation. Do not backpropagate through discrete MiroFish agents by assertion.
5. **Benchmarks:** monitor role diversity, unique hypotheses, cited-to-uncited claim ratio, false source attribution, input drift, cycle depth, runtime and cost, forecast calibration and out-of-sample scenario reliability. Run red-team tests for prompt injection through news content.

## Release and verification

- Run `npm ci && npm test && npm run lint && npm run build` and `npx tsc --noEmit -p tsconfig.app.json`.
- Deploy the updated Supabase Edge Function and any relevant MiroFish service via the existing controlled release. No additional permissions or billing routes were introduced.
- Test in the beta environment with news and without news. Confirm that unlinked hypotheses remain marked, that missing provider responses are not mocked, and that unavailable simulation rounds are not fabricated.
- Preserve the server-side synthesis quota, authenticated news-ID resolution, member gating, and the existing Stripe/release policies. Nothing here guarantees a profitable strategy, a predictive model, or a functioning live simulator.

