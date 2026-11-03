import { type ResearchEnvelope, type ResearchSource } from "./exchange";

/** Fixture-only data. These are deliberately synthetic, not upstream engine outputs. */
const EXAMPLE_METRICS: Record<ResearchSource, Record<string, number>> = {
  macm: { events: 50, steps: 12, simulated_agents: 20 },
  rhpc_smple: { posts: 40, interactions: 12, simulated_users: 18 },
  armory: { samples: 100, clean_accuracy: 0.92, perturbed_accuracy: 0.64 },
  atlantis: { findings: 3, patches_proposed: 2, tests_passed: 10 },
  dragonradio: { frames: 100, packet_loss_pct: 2.5, rssi_dbm: -61 },
  benchq: { physical_qubits: 1200, duration_seconds: 15, logical_qubits: 12 },
  pyliqtr: { logical_qubits: 12, t_count: 230, clifford_count: 520 },
  angr: { blocks: 240, functions: 31, imports: 9 },
  openroad: { cells: 850, die_area_um2: 5600, setup_wns_ns: -0.2 },
};

export function exampleResearchEnvelope(source: ResearchSource): ResearchEnvelope {
  return {
    schema_version: "gc-research-exchange/1",
    source,
    upstream_version: "synthetic-example",
    scope: "synthetic",
    aggregates: { ...EXAMPLE_METRICS[source] },
    imported_status: "UNVERIFIED_EXTERNAL_RESULT",
  };
}

export function createExampleResearchArtifact(source: ResearchSource): string {
  return JSON.stringify(exampleResearchEnvelope(source), null, 2);
}
