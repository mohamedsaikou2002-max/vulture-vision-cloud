import { describe, expect, it } from "vitest";
import { runSyntheticCascade, type CascadeConfig } from "./cascade";
const settings: CascadeConfig = {
  population: 120, steps: 10, seed: 9, initialSeeds: 2, contactsPerSharer: 3,
  shareProbability: 0.4, verificationProbability: 0.2, correctionProbability: 0.2,
};
describe("synthetic information cascade", () => {
  it("reproduces precisely given identical input and seed", () => {
    expect(runSyntheticCascade(settings)).toEqual(runSyntheticCascade(settings));
  });
  it("conserves population at each step", () => {
    for (const f of runSyntheticCascade(settings).timeline)
      expect(f.unaware + f.exposed + f.sharing + f.corrected).toBe(settings.population);
  });
  it("never manufactures contacts when sharing has zero contacts", () => {
    expect(runSyntheticCascade({ ...settings, contactsPerSharer: 0 }).reach).toBe(settings.initialSeeds);
  });
  it("rejects invalid probabilities and oversized populations", () => {
    expect(() => runSyntheticCascade({ ...settings, shareProbability: 1.01 })).toThrow(RangeError);
    expect(() => runSyntheticCascade({ ...settings, population: 2001 })).toThrow(RangeError);
  });
});
