// Shared pure logic for IBM Quantum pay-per-job billing.
// No Deno/browser imports — safe to unit-test with vitest.

export interface QuantumRateConfig {
  provider_rate_cents_per_qpu_sec: number; // IBM-side cost per QPU second
  markup_bp: number;                        // markup in basis points (2500 = 25%)
  est_qpu_secs_per_qubit_shot: number;      // conservative per-shot estimate
  quote_ttl_seconds: number;
  max_qubits: number;
  currency: string;
  stripe_configured: boolean;
  ibm_configured: boolean;
}

export interface Quote {
  est_qpu_secs: number;
  provider_cost_cents: number;
  markup_cents: number;
  quote_cents: number;
  currency: string;
  expires_at: string; // ISO
}

export const DEFAULT_CONFIG: QuantumRateConfig = {
  provider_rate_cents_per_qpu_sec: 120,
  markup_bp: 2500,
  est_qpu_secs_per_qubit_shot: 0.0004,
  quote_ttl_seconds: 900,
  max_qubits: 36,
  currency: "usd",
  stripe_configured: false,
  ibm_configured: false,
};

/** Conservative estimate: qubits² × shots × per-shot secs (superlinear in qubits). */
export function estimateQpuSecs(nQubits: number, shots: number, cfg: QuantumRateConfig): number {
  const q = Math.max(1, nQubits);
  const s = Math.max(1, shots);
  return q * q * s * cfg.est_qpu_secs_per_qubit_shot;
}

export function computeQuote(nQubits: number, shots: number, cfg: QuantumRateConfig, now = new Date()): Quote {
  const est = estimateQpuSecs(nQubits, shots, cfg);
  const provider = Math.ceil(est * cfg.provider_rate_cents_per_qpu_sec);
  const markup = Math.ceil(provider * cfg.markup_bp / 10000);
  return {
    est_qpu_secs: Math.round(est * 1000) / 1000,
    provider_cost_cents: provider,
    markup_cents: markup,
    quote_cents: provider + markup,
    currency: cfg.currency,
    expires_at: new Date(now.getTime() + cfg.quote_ttl_seconds * 1000).toISOString(),
  };
}

export function isQuoteExpired(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** Cap must cover the quote; charge may never exceed the approved cap. */
export function capValid(approvedCapCents: number | null | undefined, quoteCents: number): boolean {
  return typeof approvedCapCents === "number" && approvedCapCents >= quoteCents && approvedCapCents > 0;
}

/** Final charge from metered usage; hard-capped. Returns null if it would exceed the cap (must stop/refund). */
export function settleCharge(meteredQpuSecs: number, cfg: QuantumRateConfig, approvedCapCents: number): {
  provider_cost_cents: number; markup_cents: number; charge_cents: number; exceeds_cap: boolean;
} {
  const provider = Math.ceil(meteredQpuSecs * cfg.provider_rate_cents_per_qpu_sec);
  const markup = Math.ceil(provider * cfg.markup_bp / 10000);
  const charge = provider + markup;
  return { provider_cost_cents: provider, markup_cents: markup, charge_cents: charge, exceeds_cap: charge > approvedCapCents };
}

export type JobBlockReason = "stripe_not_configured" | "ibm_not_configured" | null;

/** A paid job may only be authorized when payment processing is configured. */
export function canAuthorize(cfg: QuantumRateConfig): JobBlockReason {
  if (!cfg.stripe_configured) return "stripe_not_configured";
  return null;
}

/** Dispatch additionally requires IBM credentials. */
export function canDispatch(cfg: QuantumRateConfig): JobBlockReason {
  if (!cfg.stripe_configured) return "stripe_not_configured";
  if (!cfg.ibm_configured) return "ibm_not_configured";
  return null;
}

export function validIdempotencyKey(k: unknown): k is string {
  return typeof k === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(k);
}
