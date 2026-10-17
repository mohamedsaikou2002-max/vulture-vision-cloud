import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

describe("Stripe beta staging command", () => {
  it("documents acceptance phases without requiring production credentials", () => {
    const run = spawnSync(process.execPath,["scripts/stripe-beta-acceptance.mjs","--help"],{
      encoding:"utf8", timeout:10000,
      env:{PATH:process.env.PATH || ""},
    });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("TEST MODE");
    for(const phase of ["preflight","checkout","paid","blocked"])expect(run.stdout).toContain(phase);
  });
  it("rejects unknown commands before making network requests",()=>{
    const run=spawnSync(process.execPath,["scripts/stripe-beta-acceptance.mjs","publish-live"],{
      encoding:"utf8",timeout:10000,env:{PATH:process.env.PATH || ""},
    });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("Unknown phase");
  });
});
