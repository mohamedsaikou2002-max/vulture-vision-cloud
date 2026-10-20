import { describe, expect, it } from "vitest";
import { MEMBERSHIP, TRIAL_PERIOD_DAYS, hasMembership } from "../lib/membership";
describe("membership rules", () => {
  it("is 1050 USD recurring monthly", () => {
    expect(MEMBERSHIP).toMatchObject({ amountCents: 105000, currency: "usd", interval: "month" });
  });
  it("includes a 24 hour free trial", () => {
    expect(MEMBERSHIP.trialHours).toBe(24);
    expect(TRIAL_PERIOD_DAYS).toBe(1);
  });
  it("requires an active or trialing subscription within its paid period", () => {
    const now = Date.parse("2026-10-19T00:00:00Z");
    expect(hasMembership({ status: "active", current_period_end: "2026-11-19T00:00:00Z" }, now)).toBe(true);
    expect(hasMembership({ status: "trialing", current_period_end: "2026-11-19T00:00:00Z" }, now)).toBe(true);
    expect(hasMembership({ status: "past_due", current_period_end: "2026-11-19T00:00:00Z" }, now)).toBe(false);
    expect(hasMembership({ status: "active", current_period_end: "2026-10-18T00:00:00Z" }, now)).toBe(false);
    expect(hasMembership(null, now)).toBe(false);
  });
});