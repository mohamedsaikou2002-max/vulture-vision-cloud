import { it, expect, vi } from "vitest";
import { loadEdgeHandler } from "./helpers/edgeHarness";
import { BILLING_OFFER, checkoutParameters, stripeRequest, subscriptionState } from "../../supabase/functions/_shared/stripe_billing";

it("keeps checkout off until configured, with the approved exact prices", async () => {
  const network = vi.fn(), database = vi.fn();
  const handler = loadEdgeHandler("vv-billing", network, {}, database);
  const response = await handler(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ action: "config" }) }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ enabled: false, offer: BILLING_OFFER });
  expect(network).not.toHaveBeenCalled();
  expect(database).not.toHaveBeenCalled();
});
it("requires authentication before membership status or Stripe checkout", async () => {
  const network = vi.fn(), database = vi.fn();
  const handler = loadEdgeHandler("vv-billing", network, {}, database);
  for (const action of ["status", "checkout", "portal"]) {
    const response = await handler(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ action }) }));
    expect(response.status).toBe(401);
  }
  expect(network).not.toHaveBeenCalled();
  expect(database).not.toHaveBeenCalled();
});
it("refuses Stripe webhooks without signing credentials or a signed event", async () => {
  const network = vi.fn(), database = vi.fn();
  const handler = loadEdgeHandler("stripe-webhook", network, {}, database);
  const response = await handler(new Request("https://example.invalid", { method: "POST", body: "{}" }));
  expect(response.status).toBe(503);
  expect(network).not.toHaveBeenCalled();
  expect(database).not.toHaveBeenCalled();
});
it("pins introductory and renewal prices in hosted checkout", () => {
  const params = checkoutParameters("cus_one", "user_one", "price_month", "price_intro", "https://example.net", 1870000000);
  expect(params.get("mode")).toBe("subscription");
  expect(params.get("subscription_data[trial_period_days]")).toBe("7");
  expect(params.get("line_items[0][price]")).toBe("price_month");
  expect(params.get("line_items[1][price]")).toBe("price_intro");
  expect(params.get("success_url")).toBe("https://example.net/welcome?billing=success");
});
it("never grants paid access from subscription status alone without the introductory payment", () => {
  const sub = {
    id: "sub_one", customer: "cus_one", status: "trialing",
    items: { data: [{ price: { id: "price_month" }, current_period_end: 1890000000 }] },
    latest_invoice: { paid: false, amount_paid: 0 },
    trial_end: 1890000000,
  };
  expect(subscriptionState(sub, "price_month").status).toBe("incomplete");
  expect(subscriptionState({ ...sub, latest_invoice: { paid: true, amount_paid: 9900 } }, "price_month").status).toBe("trialing");
});

it("rejects live-mode Stripe keys before making any provider request", async () => {
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  try {
    await expect(stripeRequest("sk_live_forbidden", "prices")).rejects.toThrow("TEST mode");
    expect(network).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
