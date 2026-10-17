// Supabase Edge Function: vv-billing.
// Signed-in users can fetch their verified status or enter Stripe-hosted Checkout/Portal.
// Never trust Stripe session success redirects for entitlements.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkedBillingEnvironment, hasActivePaidSubscription, type EntitlementRecord } from "../_shared/subscription_policy.ts";
import {
  stripeRequest, strictSiteUrl, isStripeHostedUrl,
  type StripeCustomer, type StripeCheckout, type StripePortal, type StripePrice
} from "../_shared/stripe_api.ts";

const headers = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json", "Cache-Control": "no-store",
};
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const raw = await req.text().catch(() => "");
  if (raw.length > 2048) return response({ error: "Payload too large" }, 413);
  let action = "";
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data.action !== "string") throw new Error();
    action = data.action;
  } catch { return response({ error: "Invalid billing request" }, 400); }
  if (!["status", "checkout", "portal"].includes(action)) return response({ error: "Unsupported billing operation" }, 400);

  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return response({ error: "Supabase billing service unavailable" }, 503);
  const jwt = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt || jwt === service) return response({ error: "Sign in to manage billing" }, 401);
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await sb.auth.getUser(jwt);
  if (!user || authError) return response({ error: "Invalid account session" }, 401);
  if (!user.email_confirmed_at) return response({ error: "Confirm your email address before subscribing" }, 403);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const environment = Deno.env.get("VV_BILLING_ENV"), key = Deno.env.get("STRIPE_SECRET_KEY");
  const mode = checkedBillingEnvironment(environment, key);
  const { data: settings, error: configError } = await admin.from("vv_billing_environment").select("mode").eq("id", true).maybeSingle();
  const backendReady = !!mode && !configError && settings?.mode === mode && !!Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (action === "status") {
    if (!backendReady) return response({ active: false, mode: mode || "unconfigured", billing_ready: false, state: "billing_unconfigured" });
    const { data: subscriptions, error: subError } = await admin.from("vv_billing_subscriptions")
      .select("mode,stripe_status,last_invoice_status,paid_until").eq("user_id", user.id).eq("mode", mode).limit(20);
    if (subError) return response({ error: "Billing status unavailable" }, 503);
    return response({
      active: (subscriptions || []).some((s: EntitlementRecord) => hasActivePaidSubscription(s, mode)),
      mode, billing_ready: true,
      state: "verified",
    });
  }
  if (!backendReady || !mode || !key) return response({ error: "Stripe billing is not configured or environments do not match" }, 503);
  let site: string;
  try { site = strictSiteUrl(Deno.env.get("VV_SITE_URL"), mode); }
  catch { return response({ error: "Billing return URL not configured" }, 503); }

  try {
    const { data: mapping, error: customerErr } = await admin.from("vv_billing_customers")
      .select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (customerErr) throw new Error("Customer lookup failed");
    let customerId: string = mapping?.stripe_customer_id || "";
    if (action === "checkout") {
      // Server-only quota; this is never callable by ordinary JWT clients.
      const { data: allowed, error: rateError } = await admin.rpc("vv_claim_checkout", { p_user_id: user.id });
      if (rateError) return response({ error: "Checkout rate limiter unavailable" }, 503);
      if (allowed !== true) return response({ error: "Too many checkout attempts; try again later" }, 429);
      const { data: active, error: accessError } = await admin.from("vv_billing_subscriptions")
        .select("mode,stripe_status,last_invoice_status,paid_until")
        .eq("user_id", user.id).eq("mode", mode).limit(15);
      if (accessError) throw new Error("Account status unavailable");
      if ((active || []).some((s: EntitlementRecord) => hasActivePaidSubscription(s, mode))) {
        return response({ error: "Subscription already active; open billing portal" }, 409);
      }
      const priceId = mode === "test" ? Deno.env.get("STRIPE_BETA_PRICE_ID") : Deno.env.get("STRIPE_PRO_PRICE_ID");
      if (!priceId || !/^price_[a-zA-Z0-9]+$/.test(priceId)) return response({ error: "Subscription price has not been configured" }, 503);
      const price = await stripeRequest<StripePrice>(key, "GET", "/v1/prices/" + priceId);
      if (!price.active || price.livemode !== (mode === "live") || price.type !== "recurring" || price.currency !== "usd" ||
          price.recurring?.interval !== "month") return response({ error: "Price is not an active monthly USD subscription for this environment" }, 503);
      if (!customerId) {
        const fields = new URLSearchParams();
        if (user.email) fields.set("email", user.email);
        fields.set("metadata[supabase_user_id]", user.id);
        const customer = await stripeRequest<StripeCustomer>(key, "POST", "/v1/customers", fields, "vv-user-"+mode+"-"+user.id);
        customerId = customer.id;
        const { error: saveError } = await admin.from("vv_billing_customers")
          .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
        if (saveError) throw new Error("Customer mapping could not be saved");
      }
      const fields = new URLSearchParams({
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: site + "/?checkout=success",
        cancel_url: site + "/?checkout=cancel",
        "subscription_data[metadata][supabase_user_id]": user.id,
        "metadata[supabase_user_id]": user.id,
        billing_address_collection: "required",
        allow_promotion_codes: "true",
      });
      if (Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true") fields.set("automatic_tax[enabled]", "true");
      const session = await stripeRequest<StripeCheckout>(key, "POST", "/v1/checkout/sessions", fields,
        "vv-checkout-"+mode+"-"+user.id+"-"+crypto.randomUUID());
      if (!isStripeHostedUrl(session.url, "checkout")) throw new Error("Stripe Checkout returned an untrusted URL");
      return response({ url: session.url });
    }
    if (!customerId) return response({ error: "No Stripe billing account exists" }, 404);
    const fields = new URLSearchParams({ customer: customerId, return_url: site + "/" });
    const portal = await stripeRequest<StripePortal>(key, "POST", "/v1/billing_portal/sessions", fields);
    if (!isStripeHostedUrl(portal.url, "portal")) throw new Error("Stripe Portal returned an untrusted URL");
    return response({ url: portal.url });
  } catch {
    return response({ error: "Stripe billing service unavailable; no access was granted" }, 502);
  }
});
