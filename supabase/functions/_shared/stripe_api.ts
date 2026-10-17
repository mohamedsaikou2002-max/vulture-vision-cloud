/** Stripe REST client for Supabase Edge Functions.
 * Never import into React. The Stripe secret remains server-side.
 */
export class StripeApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function strictSiteUrl(raw: string | undefined, environment: "test" | "live"): string {
  if (!raw) throw new Error("VV_SITE_URL is required");
  const url = new URL(raw);
  if ((url.protocol !== "https:" && !(environment === "test" && url.hostname === "localhost")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      url.origin !== raw.replace(/\/$/, "")) throw new Error("Invalid configured site URL");
  return url.origin;
}
export function isStripeHostedUrl(value: unknown, service: "checkout" | "portal"): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.hostname === (service === "checkout" ? "checkout.stripe.com" : "billing.stripe.com");
  } catch { return false; }
}
export async function stripeRequest<T>(
  secret: string, method: "GET" | "POST", path: string,
  fields?: URLSearchParams, idempotencyKey?: string
): Promise<T> {
  if (!/^\/v1\/[a-z0-9_/?%=&.[\]-]+$/i.test(path)) throw new Error("Unexpected Stripe API path");
  const res = await fetch("https://api.stripe.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + secret,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(fields && method === "POST" ? { body: fields.toString() } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.error("Stripe API failed", method, path.split("?")[0], res.status); // never log secrets or body
    throw new StripeApiError(res.status, "stripe_api_unavailable");
  }
  return await res.json() as T;
}
export interface StripePrice { id: string; active: boolean; livemode: boolean; currency: string; type: string; recurring?: { interval?: string }; }
export interface StripeCustomer { id: string; }
export interface StripeCheckout { id: string; url: string | null; }
export interface StripePortal { url: string; }
export interface StripeSubscription {
  id: string;
  customer: string | {id:string};
  status: string;
  current_period_end?: number;
  items?: { data?: Array<{current_period_end?: number; price?: {id:string}}> };
  latest_invoice?: string | { status?: string };
}
export function stripeCustomerId(customer: StripeSubscription["customer"]): string {
  return typeof customer === "string" ? customer : customer.id;
}
export function stripeCurrentPeriodEnd(sub: StripeSubscription): number {
  return Math.max(sub.current_period_end || 0, ...(sub.items?.data || []).map(item => item.current_period_end || 0));
}
export function stripeCurrentPriceId(sub: StripeSubscription): string {
  return sub.items?.data?.[0]?.price?.id || "";
}
export function subscriptionInvoiceStatus(sub: StripeSubscription): string {
  return typeof sub.latest_invoice === "string" ? "unknown" : sub.latest_invoice?.status || "unknown";
}
