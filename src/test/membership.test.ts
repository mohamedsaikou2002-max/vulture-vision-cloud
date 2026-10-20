import { describe, expect, it } from "vitest";
import { MEMBERSHIP, MEMBERSHIP_START_SEQUENCE, TRIAL_PERIOD_DAYS, hasMembership } from "../lib/membership";
describe("membership rules", () => {
  it("is 1050 USD recurring monthly", () => {
    expect(MEMBERSHIP).toMatchObject({ amountCents: 105000, currency: "usd", interval: "month" });
  });
  it("prices the paid introduction at 99 USD", () => {
    expect(MEMBERSHIP.pilotAmountCents).toBe(9900);
  });
  it("includes seven introductory access days", () => {
    expect(MEMBERSHIP.trialHours).toBe(168);
    expect(TRIAL_PERIOD_DAYS).toBe(7);
  });
  it("places paid introductory access before monthly membership", () => {
    expect(MEMBERSHIP_START_SEQUENCE).toEqual(["paid_intro", "monthly_membership"]);
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