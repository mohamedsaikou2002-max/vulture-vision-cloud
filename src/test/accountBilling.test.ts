import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(name:string)=>readFileSync(name,"utf8");
describe("Account billing self service",()=>{
  it("puts the account page in the authenticated workspace",()=>{
    expect(read("src/App.tsx")).toContain('path="/account"');
    expect(read("src/components/VVLayout.tsx")).toContain("ACCOUNT / BILLING");
  });
  it("lets a verified subscriber use only Stripe's own billing host",()=>{
    const source=read("src/pages/Account.tsx");
    expect(source).toContain('"vv-billing"');
    expect(source).toContain('action:"portal"');
    expect(source).toContain('url.hostname!=="billing.stripe.com"');
    expect(source).toContain("supabase.auth.signOut()");
    expect(source).not.toContain("sk_live_");
  });
});
