/**
 * Independent, synthetic information-spread toy model informed by the
 * research questions of DARPA SocialSim / MACM. It does NOT embed,
 * reproduce or claim validation against the MACM or RHPC_SMPLE engines.
 * No personal profiles, unverified allegations or live social data.
 */
export interface CascadeConfig {
  population: number;
  steps: number;
  seed: number;
  initialSeeds: number;
  contactsPerSharer: number;
  shareProbability: number;
  verificationProbability: number;
  correctionProbability: number;
}
export interface CascadeFrame {
  step: number;
  unaware: number;
  exposed: number;
  sharing: number;
  corrected: number;
}
export interface CascadeResult {
  model: "gc-synthetic-cascade-v1";
  status: "SYNTHETIC_UNVALIDATED";
  config: CascadeConfig;
  timeline: CascadeFrame[];
  reach: number;
  corrected: number;
}
const integer = (value: number, low: number, high: number) =>
  Number.isInteger(value) && value >= low && value <= high;
const probability = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;
function validate(config: CascadeConfig) {
  if (!integer(config.population, 2, 2000) || !integer(config.steps, 1, 100) ||
      !integer(config.seed, 0, 2147483647) ||
      !integer(config.initialSeeds, 1, config.population) ||
      !integer(config.contactsPerSharer, 0, 20) ||
      !probability(config.shareProbability) || !probability(config.verificationProbability) ||
      !probability(config.correctionProbability)) {
    throw new RangeError("Invalid synthetic cascade parameters");
  }
}
const prng = (seed: number) => {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), x | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
/** Discrete-time stochastic toy model. State 0 unaware, 1 exposed, 2 sharing, 3 corrected. */
export function runSyntheticCascade(config: CascadeConfig): CascadeResult {
  validate(config);
  const random = prng(config.seed);
  const state = new Uint8Array(config.population);
  // Randomized unique starting nodes, independent of their identity.
  const ids = Array.from({ length: config.population }, (_, i) => i);
  for (let i = 0; i < config.initialSeeds; i++) {
    const j = i + Math.floor(random() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
    state[ids[i]] = 2;
  }
  const counts = (step: number): CascadeFrame => {
    const n = [0, 0, 0, 0];
    for (const s of state) n[s]++;
    return { step, unaware: n[0], exposed: n[1], sharing: n[2], corrected: n[3] };
  };
  const timeline = [counts(0)];
  for (let step = 1; step <= config.steps; step++) {
    const next = state.slice();
    for (let from = 0; from < config.population; from++) {
      if (state[from] !== 2) continue;
      for (let c = 0; c < config.contactsPerSharer; c++) {
        const target = Math.floor(random() * config.population);
        if (target !== from && next[target] === 0) next[target] = 1;
      }
      if (random() < config.correctionProbability) next[from] = 3;
    }
    for (let i = 0; i < config.population; i++) {
      if (next[i] !== 1) continue;
      if (random() < config.verificationProbability) next[i] = 3;
      else if (random() < config.shareProbability) next[i] = 2;
    }
    state.set(next);
    timeline.push(counts(step));
  }
  return {
    model: "gc-synthetic-cascade-v1",
    status: "SYNTHETIC_UNVALIDATED",
    config: { ...config },
    timeline,
    reach: config.population - timeline[timeline.length - 1].unaware,
    corrected: timeline[timeline.length - 1].corrected,
  };
}
