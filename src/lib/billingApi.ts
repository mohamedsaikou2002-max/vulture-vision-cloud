import { supabase } from "@/integrations/supabase/client";

export const MEMBERSHIP_OFFER = { introCents: 9900, days: 7, monthlyCents: 105000, currency: "USD" } as const;
export interface BillingStatus {
  enabled: boolean;
  entitled: boolean;
  subscription: {
    status: string;
    current_period_end: string | null;
    trial_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}
export async function membershipStatus(): Promise<BillingStatus> {
  const { data, error } = await supabase.functions.invoke("vv-billing", { body: { action: "status" } });
  if (error || !data || typeof data.entitled !== "boolean") throw new Error("Membership status could not be verified.");
  return data as BillingStatus;
}
export async function billingAction(action: "checkout" | "portal", requestId?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("vv-billing", { body: { action, ...(requestId ? { request_id: requestId } : {}) } });
  if (error || !data || typeof data.url !== "string") throw new Error(data?.error || error?.message || "Billing is unavailable.");
  const target = new URL(data.url);
  if (target.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(target.hostname)) throw new Error("Unexpected payment destination.");
  return target.toString();
}
