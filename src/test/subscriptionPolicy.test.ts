import {describe, it, expect} from "vitest";
import {hasActivePaidSubscription, checkedBillingEnvironment} from "../../supabase/functions/_shared/subscription_policy";
const now = new Date("2026-10-16T12:00:00Z");
const paid={mode:"test",stripe_status:"active",last_invoice_status:"paid",last_invoice_amount_paid_cents:9900,paid_until:"2026-11-16T00:00:00Z"};
describe("paid subscription server policy",()=>{
  it("only grants current invoice-paid, active subscriptions in the matching environment",()=>{
    expect(hasActivePaidSubscription(paid,"test",now)).toBe(true);
    expect(hasActivePaidSubscription(paid,"live",now)).toBe(false);
    for(const status of ["past_due","incomplete","canceled","trialing","unpaid"])
      expect(hasActivePaidSubscription({...paid,stripe_status:status},"test",now)).toBe(false);
    expect(hasActivePaidSubscription({...paid,last_invoice_amount_paid_cents:0},"test",now)).toBe(false);
    expect(hasActivePaidSubscription({...paid,last_invoice_amount_paid_cents:-1},"test",now)).toBe(false);
    for(const invoice of ["open","uncollectible","void","unknown"])
      expect(hasActivePaidSubscription({...paid,last_invoice_status:invoice},"test",now)).toBe(false);
    expect(hasActivePaidSubscription({...paid,paid_until:"2026-10-15T00:00:00Z"},"test",now)).toBe(false);
    expect(hasActivePaidSubscription({...paid,paid_until:null},"test",now)).toBe(false);
    expect(hasActivePaidSubscription({...paid,paid_until:"not-a-date"},"test",now)).toBe(false);
  });
  it("rejects accidental use of test Stripe credentials in production",()=>{
    expect(checkedBillingEnvironment("test","sk_test_123456789")).toBe("test");
    expect(checkedBillingEnvironment("live","rk_live_123456789")).toBe("live");
    expect(checkedBillingEnvironment("live","sk_test_123456789")).toBeNull();
    expect(checkedBillingEnvironment("test","invalid")).toBeNull();
    expect(checkedBillingEnvironment(undefined,"sk_live_abc")).toBeNull();
  });
});
