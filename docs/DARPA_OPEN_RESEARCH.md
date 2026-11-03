# DARPA-origin open research integration — 2026-11-03

## Shipped in this branch
- A new, deterministic, bounded **synthetic information cascade simulator** and UI panel with tests, inspired by the *research question* of DARPA SocialSim / MACM. **This is an independent toy model, not the SocialSim, MACM, or RHPC_SMPLE upstream implementation.** It operates locally on hypothetical nodes and never imports live identity, customer, or market data.
- Result labeling **SYNTHETIC / UNVALIDATED**, plus a negative control (zero contacts) in automated tests.
- No new runtime dependencies, third-party code copying, backend credentials, external API calls, or autonomous actions.

## Upstream discovery and separately gated integrations (not yet installed)
| Source | Upstream | Integration consideration |
| --- | --- | --- |
| DARPA SocialSim: MACM | https://github.com/chathika/MACM | Review data formats, license, reproducibility; optional external simulator/container |
| DARPA SocialSim: RHPC_SMPLE | https://github.com/UCF-SocialSim/RHPC_SMPLE | Research-only social-media emulator, subject to license/dataset review |
| DARPA GARD Armory | https://github.com/twosixlabs/armory-library | Offline adversarial AI robustness evaluation via its documented API |
| AIxCC Atlantis | https://github.com/Team-Atlanta/aixcc-afc-atlantis | Isolated, explicitly authorized defensive code audit; not a browser integration |
| DARPA SC2 DragonRadio | https://drexelwireless.github.io/dragonradio/intro.html | SDR lab testbed; must not imply clinical sensing or through-wall detection |
| DARPA Quantum Benchmarking BenchQ | https://github.com/zapatacomputing/benchq | Compute-intensive resource-estimate worker; separate Python environment |
| DARPA QB pyLIQTR | https://github.com/isi-usc-edu/pyLIQTR | Optional circuit resource estimator; separate Python environment |
| DARPA IDEA OpenROAD | https://github.com/The-OpenROAD-Project/OpenROAD | Hardware design workflow only, not a web-app package |

**Integrations are not equivalent to installing every upstream project in all products.** Use project-specific isolated workers after checking upstream commit SHA, license, dependencies, privacy, threat model, hardware, and performance. The old GARD Armory repository is deprecated; use armory-library.
