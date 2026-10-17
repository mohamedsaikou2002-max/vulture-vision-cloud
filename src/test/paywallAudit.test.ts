import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read = (p:string)=>readFileSync(p,"utf8");
describe("Premium access enforcement integration inventory",()=>{
 it("enforces entitlement on all valuable user Edge endpoints",()=>{
   for(const name of ["vv-market","vv-news","vv-onion-search","vv-simulation","vv-simulation-chat",
     "vv-scenario-brief","vv-quantum-jobs","vv-analytics","vv-chat","vv-quantum","vv-trades",
     "vv-synthesis","vv-mirofish","vv-killswitch","vv-tor-ingest","vv-research-proxy"]){
      const source=read("supabase/functions/"+name+"/index.ts");
      expect(/(requirePaid|paidAccessForUser|authorize)\(/.test(source),name+" must authenticate and check paid access").toBe(true);
   }
   expect(read("supabase/functions/_shared/access.ts")).toContain("paidAccessForUser(user.id)");
 });
 it("gates selected PostgREST tables and doesn't expose private ledger rows",()=>{
   const sql=read("supabase/migrations/20261016190000_vv_paid_entitlements.sql");
   for(const table of ["news_articles","news_prompt_versions","tor_entries"])
      expect(sql).toContain("'"+table+"'");
   expect(sql).toContain("USING (public.vv_has_paid_access())");
   expect(sql).toContain("REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated");
   expect(sql).toContain("s.last_invoice_status='paid'");
   expect(sql).toContain("s.last_invoice_amount_paid_cents > 0");
 });
 it("keeps the billing secret and price selection on the server",()=>{
   const frontend=read("src/components/AuthGate.tsx");
   expect(frontend).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/);
   const backend=read("supabase/functions/vv-billing/index.ts");
   expect(backend).toContain('Deno.env.get("STRIPE_SECRET_KEY")');
   expect(backend).toContain("vv_claim_checkout");
   expect(backend).not.toContain("body.price");
 });
 it("does not let a payment success URL grant access",()=>{
   const frontend=read("src/components/AuthGate.tsx");
   expect(frontend).toContain('billing?.active');
   expect(frontend).not.toContain('location.search.includes("success")');
 });
});
