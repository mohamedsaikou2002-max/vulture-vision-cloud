import { describe, it, expect } from "vitest";
import { isValidStripeSignature } from "../../supabase/functions/_shared/stripe_webhook_signature";
import {
  activeAfterStripeEvent, projectStripeSubscription, subscriptionIdFromStripeEvent,
  type SignedEventShape,
} from "../../supabase/functions/_shared/stripe_reconciliation";
import { hasActivePaidSubscription } from "../../supabase/functions/_shared/subscription_policy";
import type { StripeSubscription } from "../../supabase/functions/_shared/stripe_api";

const now = new Date("2026-10-16T12:00:00Z");
const active: StripeSubscription = {
  id:"sub_123456",customer:"cus_765432",status:"active",
  items:{data:[{current_period_end:1823817600,price:{id:"price_Beta123"}}]},
  latest_invoice:{status:"paid",amount_paid:9900},
};
const event=(type:string,obj:Record<string,unknown>,livemode=false,id="evt_123456"):SignedEventShape =>
  ({id,type,livemode,data:{object:obj}});
async function signed(ev:SignedEventShape, secret="whsec_local_testing") {
  const raw = JSON.stringify(ev), t = Math.floor(Date.now()/1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(t+"."+raw)));
  const sig=Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
  return {raw,signature:"t="+t+",v1="+sig};
}

describe("Milestone 2 — signed payment → entitlement → revocation",()=>{
  it("recognizes both legacy and modern invoice event subscription layouts",()=>{
    expect(subscriptionIdFromStripeEvent(event("invoice.paid",{subscription:"sub_123456"}))).toBe("sub_123456");
    expect(subscriptionIdFromStripeEvent(event("invoice.paid",{parent:{subscription_details:{subscription:"sub_123456"}}}))).toBe("sub_123456");
    expect(subscriptionIdFromStripeEvent(event("checkout.session.completed",{subscription:"sub_123456"}))).toBe("sub_123456");
    expect(subscriptionIdFromStripeEvent(event("customer.subscription.deleted",{id:"sub_123456"}))).toBe("sub_123456");
    expect(subscriptionIdFromStripeEvent(event("invoice.paid",{parent:{subscription_details:{subscription:"not_valid"}}}))).toBeNull();
  });
  it("rejects unsigned, tampered and cross-mode payment events before processing",async()=>{
    const created=event("invoice.paid",{parent:{subscription_details:{subscription:active.id}}});
    const signedEvent=await signed(created);
    expect(await isValidStripeSignature(signedEvent.raw,signedEvent.signature,"whsec_local_testing")).toBe(true);
    expect(await isValidStripeSignature(signedEvent.raw+" ",signedEvent.signature,"whsec_local_testing")).toBe(false);
    expect(activeAfterStripeEvent({...created,livemode:true},active,"test","price_Beta123",now)).toBe(false);
    expect(activeAfterStripeEvent(created,active,"live","price_Beta123",now)).toBe(false);
  });
  it("does not unlock an account on successful checkout redirect alone",()=>{
    const checkout=event("checkout.session.completed",{subscription:active.id});
    const unpaid={...active,latest_invoice:{status:"open"}};
    expect(activeAfterStripeEvent(checkout,unpaid,"test","price_Beta123",now)).toBe(false);
  });
  it("unlocks only after a current paid invoice on the matching test subscription",()=>{
    const paid=event("invoice.paid",{parent:{subscription_details:{subscription:active.id}}});
    expect(activeAfterStripeEvent(paid,active,"test","price_Beta123",now)).toBe(true);
    expect(activeAfterStripeEvent(paid,{...active,latest_invoice:{status:"paid",amount_paid:0}},"test","price_Beta123",now)).toBe(false);
    expect(activeAfterStripeEvent(paid,active,"test","price_NotOurPlan",now)).toBe(false);
    expect(activeAfterStripeEvent(paid,{...active,status:"trialing"},"test","price_Beta123",now)).toBe(false);
    expect(activeAfterStripeEvent(paid,{...active,latest_invoice:"in_123456"},"test","price_Beta123",now)).toBe(false);
  });
  it("blocks failed invoices, immediate cancellation and expired paid-through dates",()=>{
    const fail=event("invoice.payment_failed",{subscription:active.id});
    expect(activeAfterStripeEvent(fail,{...active,status:"past_due",latest_invoice:{status:"open"}},"test","price_Beta123",now)).toBe(false);
    const deleted=event("customer.subscription.deleted",{id:active.id});
    expect(activeAfterStripeEvent(deleted,{...active,status:"canceled"},"test","price_Beta123",now)).toBe(false);
    expect(activeAfterStripeEvent(fail,{
      ...active,items:{data:[{current_period_end:1000000000,price:{id:"price_Beta123"}}]}
    },"test","price_Beta123",now)).toBe(false);
  });
  it("does not grant live access using the beta event or price",()=>{
    const paid=event("invoice.paid",{subscription:active.id},false);
    expect(activeAfterStripeEvent(paid,active,"live","price_Beta123",now)).toBe(false);
    const spoofedLive={...paid,livemode:true};
    expect(activeAfterStripeEvent(spoofedLive,active,"live","price_Live123",now)).toBe(false);
    expect(activeAfterStripeEvent(spoofedLive,active,"live","price_Beta123",now)).toBe(true);
  });
  it("fails closed on missing or malformed subscription periods and unknown price",()=>{
    for(const sub of [
      {...active,items:{data:[{price:{id:"price_Beta123"}}]}},
      {...active,items:{data:[{price:{id:"price_Beta123"},current_period_end:Infinity}]}},
      {...active,items:{data:[]}},
    ]) {
      expect(hasActivePaidSubscription(projectStripeSubscription(sub,"test","price_Beta123"),"test",now)).toBe(false);
    }
  });
});
