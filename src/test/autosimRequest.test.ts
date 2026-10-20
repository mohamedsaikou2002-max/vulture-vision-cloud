import { describe, it, expect } from "vitest";
import { dailyLimit, boundedPaths, parseAutoSimRequest } from "../../supabase/functions/_shared/autosim_request";
const base = { job_id: "a1d0aadc-48c7-4b7d-a977-4040721954a8", scenario: "An exchange halts withdrawals for three days" };
describe("AutoSim request limits", () => {
  it("caps daily runs at 40 even for invalid configuration", () => { expect(dailyLimit()).toBe(40); expect(dailyLimit("1000")).toBe(40); expect(dailyLimit("3")).toBe(3); });
  it("bounds numerical paths", () => { expect(boundedPaths("999999", 200, 200)).toBe(200); expect(boundedPaths("10", 200, 200)).toBe(10); });
  it("requires a UUID and bounded scenario", () => { expect(parseAutoSimRequest(base).scenario).toBe(base.scenario); expect(() => parseAutoSimRequest({ ...base, job_id: "not-an-id" })).toThrow(); expect(() => parseAutoSimRequest({ ...base, scenario: "x".repeat(2001) })).toThrow(); });
  it("rejects nonfinite or oversized shocks", () => { expect(() => parseAutoSimRequest({ ...base, inject: { dimension: "fear", delta: Infinity } })).toThrow(); expect(() => parseAutoSimRequest({ ...base, inject: { dimension: "fear", delta: 0.21 } })).toThrow(); expect(parseAutoSimRequest({ ...base, inject: { dimension: "fear", delta: 0.2 } }).inject).toEqual({ dimension: "fear", delta: 0.2 }); });
  it("limits agent questions to 400 characters", () => { expect(() => parseAutoSimRequest({ action: "interrogate", job_id: base.job_id, agent: "banks", question: "x".repeat(401) })).toThrow(); });
});