export const MEMBERSHIP = { amountCents: 9900, currency: "usd", interval: "month" } as const;

export interface MembershipRecord {
  status: string;
  current_period_end: string | null;
}

export function hasMembership(record: MembershipRecord | null, now = Date.now()): boolean {
  return Boolean(record && ["active", "trialing"].includes(record.status)
    && record.current_period_end && new Date(record.current_period_end).getTime() > now);
}