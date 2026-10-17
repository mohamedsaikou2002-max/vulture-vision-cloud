import {describe,it,expect} from "vitest";
import {strictSiteUrl,isStripeHostedUrl,subscriptionInvoiceStatus,stripeCurrentPeriodEnd} from "../../supabase/functions/_shared/stripe_api";
import {isValidStripeSignature} from "../../supabase/functions/_shared/stripe_webhook_signature";
describe("Stripe billing request boundaries",()=>{
 it("refuses untrusted redirect URLs and prevents open-redirect tricks",()=>{
   expect(strictSiteUrl("https://greycompany.lovable.app/","live")).toBe("https://greycompany.lovable.app");
   expect(strictSiteUrl("http://localhost:8080","test")).toBe("http://localhost:8080");
   expect(()=>strictSiteUrl("http://attacker.example","live")).toThrow();
   expect(()=>strictSiteUrl("https://other.example/path","live")).toThrow();
   expect(isStripeHostedUrl("https://checkout.stripe.com/pay/cs_test","checkout")).toBe(true);
   expect(isStripeHostedUrl("https://checkout.stripe.com.evil.test/pay","checkout")).toBe(false);
   expect(isStripeHostedUrl("https://evil.test/","portal")).toBe(false);
 });
 it("requires an actual paid latest invoice and current period data",()=>{
   expect(subscriptionInvoiceStatus({id:"sub",customer:"cus",status:"active",latest_invoice:{status:"paid"}})).toBe("paid");
   expect(subscriptionInvoiceStatus({id:"sub",customer:"cus",status:"active",latest_invoice:"in_old_shape"})).toBe("unknown");
   expect(stripeCurrentPeriodEnd({id:"sub",customer:"cus",status:"active",items:{data:[{current_period_end:1800000000}]}})).toBe(1800000000);
 });
});
describe("Stripe webhook HMAC verification",()=>{
 const secret="whsec_test_secure_signature";
 it("verifies signed raw payloads, rejects tampering, replay and wrong signing secret",async()=>{
   const now=1800000000,raw='{"id":"evt_test","type":"invoice.paid"}';
   const encoder=new TextEncoder();
   const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
   const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(now+"."+raw)));
   const hex=Array.from(digest).map(n=>n.toString(16).padStart(2,"0")).join("");
   const sig="t="+now+",v1="+hex;
   expect(await isValidStripeSignature(raw,sig,secret,now)).toBe(true);
   expect(await isValidStripeSignature(raw+" ",sig,secret,now)).toBe(false);
   expect(await isValidStripeSignature(raw,sig,secret,now+301)).toBe(false);
   expect(await isValidStripeSignature(raw,sig,"whsec_wrong",now)).toBe(false);
   expect(await isValidStripeSignature(raw,"t="+now+",v1="+"0".repeat(64),secret,now)).toBe(false);
 });
});
