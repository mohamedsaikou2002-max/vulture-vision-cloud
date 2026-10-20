export const MEMBERSHIP = { amountCents: 105000, pilotAmountCents: 9900, currency: "usd", interval: "month", trialHours: 168 } as const;
export const MEMBERSHIP_START_SEQUENCE = ["paid_intro", "monthly_membership"] as const;
// Seven days of paid introductory access, followed by monthly membership. Activation is server-controlled.
export const TRIAL_PERIOD_DAYS = MEMBERSHIP.trialHours / 24;

export interface MembershipRecord {
  status: string;
  current_period_end: string | null;
}

export function hasMembership(record: MembershipRecord | null, now = Date.now()): boolean {
  return Boolean(record && ["active", "trialing"].includes(record.status)
    && record.current_period_end && new Date(record.current_period_end).getTime() > now);
}