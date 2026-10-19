import { describe, expect, it } from "vitest";
import { MEMBERSHIP, hasMembership } from "../lib/membership";
describe("membership rules", () => {
  it("is 99 USD recurring monthly", () => {
    expect(MEMBERSHIP).toEqual({ amountCents: 9900, currency: "usd", interval: "month" });
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