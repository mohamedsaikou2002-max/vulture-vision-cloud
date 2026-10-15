import { describe, it, expect } from "vitest";
import {
  computeQuote, estimateQpuSecs, isQuoteExpired, capValid, settleCharge,
  canAuthorize, canDispatch, validIdempotencyKey, DEFAULT_CONFIG,
} from "../../supabase/functions/_shared/quantum_billing";

const cfg = { ...DEFAULT_CONFIG };

describe("quantum pay-per-job billing rules", () => {
  it("default is classical-only: paid flow is blocked when Stripe is not configured", () => {
    expect(canAuthorize(cfg)).toBe("stripe_not_configured");
    expect(canDispatch(cfg)).toBe("stripe_not_configured");
  });

  it("unpaid denial: even with IBM credentials, no paid job without payment config", () => {
    const withIbm = { ...cfg, ibm_configured: true };
    expect(canAuthorize(withIbm)).toBe("stripe_not_configured");
    expect(canDispatch(withIbm)).toBe("stripe_not_configured");
  });

  it("missing IBM config blocks dispatch but not authorization", () => {
    const withStripe = { ...cfg, stripe_configured: true };
    expect(canAuthorize(withStripe)).toBeNull();
    expect(canDispatch(withStripe)).toBe("ibm_not_configured");
  });

  it("quote math: provider cost + 25% markup, superlinear in qubits", () => {
    const q = computeQuote(8, 1024, cfg, new Date("2026-01-01T00:00:00Z"));
    // est = 8*8*1024*0.0004 = 26.2144s → provider = ceil(26.2144*160) = 4195
    expect(q.est_qpu_secs).toBeCloseTo(26.214, 2);
    expect(q.provider_cost_cents).toBe(4195);
    expect(q.markup_cents).toBe(Math.ceil(4195 * 0.25));
    expect(q.quote_cents).toBe(q.provider_cost_cents + q.markup_cents);
    expect(estimateQpuSecs(16, 1024, cfg)).toBeGreaterThan(2 * estimateQpuSecs(8, 1024, cfg));
  });

  it("quote expires after TTL", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const q = computeQuote(4, 128, cfg, now);
    expect(isQuoteExpired(q.expires_at, new Date(now.getTime() + 899_000))).toBe(false);
    expect(isQuoteExpired(q.expires_at, new Date(now.getTime() + 901_000))).toBe(true);
    expect(isQuoteExpired(null)).toBe(true);
  });

  it("cap must cover the quote", () => {
    expect(capValid(500, 400)).toBe(true);
    expect(capValid(399, 400)).toBe(false);
    expect(capValid(null, 400)).toBe(false);
    expect(capValid(0, 400)).toBe(false);
  });

  it("meter correctness: settlement uses actual metered seconds, never a fixed price", () => {
    const s = settleCharge(10, cfg, 10000); // 10s * 160c = 1600 + 25% = 2000
    expect(s.provider_cost_cents).toBe(1600);
    expect(s.markup_cents).toBe(400);
    expect(s.charge_cents).toBe(2000);
    expect(s.exceeds_cap).toBe(false);
  });

  it("hard cap: settlement exceeding the approved cap is flagged, never silently charged", () => {
    const s = settleCharge(100, cfg, 1000); // 16000 + 4000 = 20000 > 1000
    expect(s.exceeds_cap).toBe(true);
  });

  it("idempotency keys: strict format, replay-safe", () => {
    expect(validIdempotencyKey("abc12345-_XYZ")).toBe(true);
    expect(validIdempotencyKey("short")).toBe(false);
    expect(validIdempotencyKey("has spaces in it")).toBe(false);
    expect(validIdempotencyKey(12345)).toBe(false);
    expect(validIdempotencyKey("")).toBe(false);
  });
});
