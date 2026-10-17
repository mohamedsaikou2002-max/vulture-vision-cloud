/** Policy is deliberately strict: a checkout redirect alone never grants access.
 * Only a paid Stripe invoice, current active subscription and unexpired coverage do.
 */
export interface EntitlementRecord {
  mode: string;
  stripe_status: string;
  last_invoice_status: string;
  last_invoice_amount_paid_cents: number;
  paid_until: string | null;
}
export function hasActivePaidSubscription(
  row: EntitlementRecord,
  environment: "test" | "live",
  at: Date = new Date()
): boolean {
  const until = row.paid_until ? Date.parse(row.paid_until) : Number.NaN;
  return row.mode === environment &&
    row.stripe_status === "active" &&
    row.last_invoice_status === "paid" &&
    Number.isSafeInteger(row.last_invoice_amount_paid_cents) && row.last_invoice_amount_paid_cents > 0 &&
    Number.isFinite(until) && until > at.getTime();
}
export function checkedBillingEnvironment(env: string | undefined, key: string | undefined): "test" | "live" | null {
  if (env !== "test" && env !== "live") return null;
  if (!key || !new RegExp("^(sk|rk)_" + env + "_[A-Za-z0-9]+$").test(key)) return null;
  return env;
}
