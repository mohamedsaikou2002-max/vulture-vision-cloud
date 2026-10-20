export const MEMBERSHIP = { amountCents: 105000, currency: "usd", interval: "month", trialHours: 24 } as const;
// Stripe trials are set in whole days; 24h = 1 day.
export const TRIAL_PERIOD_DAYS = MEMBERSHIP.trialHours / 24;

export interface MembershipRecord {
  status: string;
  current_period_end: string | null;
}

export function hasMembership(record: MembershipRecord | null, now = Date.now()): boolean {
  return Boolean(record && ["active", "trialing"].includes(record.status)
    && record.current_period_end && new Date(record.current_period_end).getTime() > now);
}