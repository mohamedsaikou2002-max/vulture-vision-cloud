/** Stripe event normalization and paid-access projection.
 * Pure, deterministic functions make the signed-webhook lifecycle testable
 * without an external Stripe account or a payment-card request.
 */
import {
  stripeCurrentPeriodEnd, stripeCurrentPriceId, stripeCustomerId, subscriptionInvoiceStatus, subscriptionInvoicePaidCents,
  type StripeSubscription,
} from "./stripe_api.ts";
import { hasActivePaidSubscription, type EntitlementRecord } from "./subscription_policy.ts";

export type StripeMode = "test" | "live";
export interface SignedEventShape {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: {
    id?: string;
    subscription?: string | { id?: string };
    parent?: { subscription_details?: { subscription?: string | { id?: string } } };
  } };
}
export function subscriptionIdFromStripeEvent(event: SignedEventShape): string | null {
  const item = event.data?.object;
  if (!item) return null;
  let candidate: string | {id?:string} | undefined;
  if (event.type.startsWith("customer.subscription.")) candidate = item.id;
  else if (event.type.startsWith("checkout.session.")) candidate = item.subscription;
  else if (event.type.startsWith("invoice.")) candidate =
    item.subscription ?? item.parent?.subscription_details?.subscription;
  const id = typeof candidate === "string" ? candidate : candidate?.id;
  return typeof id === "string" && /^sub_[a-zA-Z0-9]+$/.test(id) ? id : null;
}
export interface LedgerProjection extends EntitlementRecord {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  price_id: string;
}
export function projectStripeSubscription(
  subscription: StripeSubscription,
  mode: StripeMode,
  expectedPrice: string | undefined
): LedgerProjection {
  const price = stripeCurrentPriceId(subscription);
  const customer = stripeCustomerId(subscription.customer);
  const until = stripeCurrentPeriodEnd(subscription);
  // Unknown price, absent invoice or invalid paid period never grants access.
  const trusted = !!expectedPrice && price === expectedPrice;
  const paidUntil = Number.isSafeInteger(until) && until > 0 && until <= 253402300799
    ? new Date(until * 1000).toISOString()
    : null;
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customer,
    price_id: price || "unknown",
    mode,
    stripe_status: trusted ? subscription.status : "unsupported_price",
    last_invoice_status: subscriptionInvoiceStatus(subscription),
    last_invoice_amount_paid_cents: subscriptionInvoicePaidCents(subscription),
    paid_until: paidUntil,
  };
}
export function activeAfterStripeEvent(
  event: SignedEventShape,
  subscription: StripeSubscription,
  mode: StripeMode,
  expectedPrice: string | undefined,
  now: Date
): boolean {
  if (event.livemode !== (mode === "live") || subscriptionIdFromStripeEvent(event) !== subscription.id)
    return false;
  return hasActivePaidSubscription(projectStripeSubscription(subscription,mode,expectedPrice),mode,now);
}
