# DARPA upstream research exchange — integration contract

This revision **connects all nine public research codebases at the artifact exchange layer**. A standalone local-only browser panel imports a strict, bounded aggregate JSON contract. It does **not** install, execute, or relicense the original upstream engines. Upstream output exporters live in their respective isolated workers; direct tools must be provisioned on suitable infrastructure.

| Source | Integration pathway | Source project |
|---|---|---|
| MACM | GPU social-simulation aggregate data exchange, no user IDs | https://github.com/chathika/MACM |
| RHPC_SMPLE | MPI platform simulation aggregate data exchange | https://github.com/UCF-SocialSim/RHPC_SMPLE |
| GARD Armory | Robustness evaluation aggregate import | https://github.com/twosixlabs/armory-library |
| AIxCC ATLANTIS | Defensive finding-count import (not executable exploits) | https://github.com/Team-Atlanta/aixcc-afc-atlantis |
| DragonRadio | Laboratory-only recorded RF quality metrics import | https://github.com/drexelwireless/dragonradio |
| BenchQ | Quantum resource estimate import | https://github.com/zapatacomputing/benchq |
| pyLIQTR | Circuit resource estimate import | https://github.com/isi-usc-edu/pyLIQTR |
| angr | Authorized local binary property counts import | https://github.com/angr/angr |
| OpenROAD | Chip-design quality-of-results metrics import | https://github.com/The-OpenROAD-Project/OpenROAD |

`DARPA Firefox` is a proposed research program, not a freely available open-source package: https://www.darpa.mil/research/programs/firefox

MACM and RHPC_SMPLE both include **GPLv3** licensing terms; review obligations before packaging or distributing derivative work. Use an external, separately managed worker and simple aggregate data exchange; avoid copying source into proprietary products. pyLIQTR's README and code include an MIT/BSD license attribution discrepancy; verify the actual distributed files with counsel when commercializing.

## Minimal artifact
```json
{"schema_version":"gc-research-exchange/1","source":"macm","upstream_version":"unknown","scope":"synthetic","aggregates":{"events":50,"steps":12,"simulated_agents":20},"imported_status":"UNVERIFIED_EXTERNAL_RESULT"}
```

Supported scopes: `synthetic` or `authorized_lab`. Supports source-specific numeric aggregate keys only. The UI never saves artifacts to a shared or cloud database. Data from real individuals, unverified allegations, identifiable patients or radio-surveillance targets must not be used. No simulation output establishes evidence of an actual threat or group action.
