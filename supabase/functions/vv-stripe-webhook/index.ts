// Public Stripe webhook: only authentic Stripe-Signature events can reconcile billing.
// Deploy with verify_jwt=false. All customers must be mapped to a real Supabase user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidStripeSignature } from "../_shared/stripe_webhook_signature.ts";
import {
  stripeRequest, stripeCurrentPeriodEnd, stripeCurrentPriceId,
  stripeCustomerId, subscriptionInvoiceStatus, type StripeSubscription
} from "../_shared/stripe_api.ts";
import { checkedBillingEnvironment } from "../_shared/subscription_policy.ts";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers });
interface EventObject { id?: string; customer?: string; subscription?: string | {id?:string}; parent?: {subscription_details?: {subscription?:string}}; }
interface StripeEvent { id: string; type: string; livemode: boolean; data: {object: EventObject}; }

const isSubscriptionEvent = (type: string) => [
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "invoice.paid", "invoice.payment_failed", "invoice.voided", "invoice.marked_uncollectible",
].includes(type);

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "POST required" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  const mode = checkedBillingEnvironment(Deno.env.get("VV_BILLING_ENV"), key);
  if (!mode || !secret || !key) return response({ error: "Stripe webhook not configured" }, 503);
  const raw = await req.text().catch(() => "");
  if (!(await isValidStripeSignature(raw, req.headers.get("stripe-signature"), secret)))
    return response({ error: "Invalid Stripe signature" }, 400);
  let event: StripeEvent;
  try { event = JSON.parse(raw); }
  catch { return response({ error: "Invalid event payload" }, 400); }
  if (!/^evt_[A-Za-z0-9]+$/.test(event.id) || event.livemode !== (mode === "live") || !event.data?.object) {
    return response({ error: "Stripe account or environment mismatch" }, 400);
  }
  if (!isSubscriptionEvent(event.type)) return response({ received: true });
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !service) return response({ error: "Database not configured" }, 503);
  const db = createClient(supabaseUrl, service, { auth: { persistSession: false } });
  const { data: setting, error: settingError } = await db.from("vv_billing_environment")
    .select("mode").eq("id", true).maybeSingle();
  if (settingError || setting?.mode !== mode) return response({ error: "Database billing environment mismatch" }, 503);

  const { data: inserted, error: claimError } = await db.from("vv_stripe_webhook_events")
    .upsert({ stripe_event_id: event.id, status: "processing" }, { onConflict: "stripe_event_id", ignoreDuplicates: true })
    .select("stripe_event_id");
  if (claimError) return response({ error: "Webhook receipt could not be recorded" }, 503);
  if (!inserted?.length) {
    const { data: previous } = await db.from("vv_stripe_webhook_events").select("status")
      .eq("stripe_event_id", event.id).maybeSingle();
    return previous?.status === "processed"
      ? response({ received: true, replay: true })
      : response({ error: "Webhook processing is still in progress" }, 503);
  }
  try {
    const item = event.data.object;
    const subCandidate = event.type.startsWith("customer.subscription.") ? item.id :
      event.type.startsWith("checkout.session.") ?
        (typeof item.subscription === "string" ? item.subscription : item.subscription?.id) :
        (typeof item.subscription === "string" ? item.subscription : item.subscription?.id) ||
          item.parent?.subscription_details?.subscription;
    if (subCandidate && /^sub_[A-Za-z0-9]+$/.test(subCandidate)) {
      // Fetch CURRENT subscription from Stripe to guard against out-of-order old webhooks.
      const subscription = await stripeRequest<StripeSubscription>(key, "GET",
        "/v1/subscriptions/" + subCandidate + "?expand[]=latest_invoice");
      const customer = stripeCustomerId(subscription.customer);
      const { data: account, error: ownerError } = await db.from("vv_billing_customers")
        .select("user_id").eq("stripe_customer_id", customer).maybeSingle();
      if (ownerError) throw new Error("Customer lookup failed");
      if (account) {
        const price = stripeCurrentPriceId(subscription);
        const expectedPrice = mode === "test" ? Deno.env.get("STRIPE_BETA_PRICE_ID") : Deno.env.get("STRIPE_PRO_PRICE_ID");
        const permitted = !!expectedPrice && price === expectedPrice;
        const periodEnd = stripeCurrentPeriodEnd(subscription);
        const lastInvoice = subscriptionInvoiceStatus(subscription);
        // Never entitle unknown price or unpaid invoice, even when Stripe says 'active'.
        const { error: subscriptionError } = await db.from("vv_billing_subscriptions").upsert({
          stripe_subscription_id: subscription.id,
          user_id: account.user_id,
          stripe_customer_id: customer,
          price_id: price || "unknown",
          mode,
          stripe_status: permitted ? subscription.status : "unsupported_price",
          last_invoice_status: lastInvoice,
          paid_until: periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id" });
        if (subscriptionError) throw new Error("Subscription ledger update failed");
      }
    }
    const { error: saveError } = await db.from("vv_stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id).eq("status", "processing");
    if (saveError) throw new Error("Webhook checkpoint update failed");
    return response({ received: true });
  } catch {
    // Stripe will retry; free the claim for idempotent retry after a transient failure.
    await db.from("vv_stripe_webhook_events").delete()
      .eq("stripe_event_id", event.id).eq("status", "processing");
    return response({ error: "Webhook reconciliation failed" }, 503);
  }
});
