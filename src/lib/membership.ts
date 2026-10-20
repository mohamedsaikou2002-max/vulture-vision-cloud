export const MEMBERSHIP = { amountCents: 105000, pilotAmountCents: 9999, currency: "usd", interval: "month", trialHours: 168 } as const;
export const MEMBERSHIP_START_SEQUENCE = ["paid_pilot", "free_trial", "monthly_membership"] as const;
// The seven-day free trial follows the paid pilot; checkout remains unconfigured.
export const TRIAL_PERIOD_DAYS = MEMBERSHIP.trialHours / 24;

export interface MembershipRecord {
  status: string;
  current_period_end: string | null;
}

export function hasMembership(record: MembershipRecord | null, now = Date.now()): boolean {
  return Boolean(record && ["active", "trialing"].includes(record.status)
    && record.current_period_end && new Date(record.current_period_end).getTime() > now);
}