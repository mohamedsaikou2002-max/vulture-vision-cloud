#!/usr/bin/env node
// Vulture beta Stripe acceptance; TEST MODE ONLY. No secret logging.
// Checkout is initiated only if the operator chooses the checkout phase.
const help = [
  "Vulture Vision beta Stripe acceptance harness (TEST MODE ONLY).",
  "Set VV_BETA_SUPABASE_URL, VV_BETA_PUBLISHABLE_KEY, VV_BETA_TEST_EMAIL,",
  "VV_BETA_TEST_PASSWORD and VV_BETA_CONFIRM_TEST_MODE=I_UNDERSTAND_THIS_IS_TEST_ONLY.",
  "Use an email-confirmed test user in a separate beta Supabase project.",
  "Commands: preflight | checkout | paid | blocked | --help.",
  "preflight: unpaid account returns 402; unsigned webhook rejected 400.",
  "checkout: get test-only Stripe Checkout URL; manually pay via a test card.",
  "paid: wait for signed invoice webhook, expect active and no 402.",
  "blocked: failed payment, immediate cancellation or expired access returns 402.",
  "Cancel-at-period-end usually retains access until paid-through time.",
].join("\n")+"\n";
const phase=process.argv[2]||"--help";
if(phase==="--help"){process.stdout.write(help);process.exit(0);}
if(!["preflight","checkout","paid","blocked"].includes(phase)){
  process.stderr.write("Unknown phase. Run --help.\n");process.exit(2);
}
const need=name=>{
  const value=process.env[name]?.trim();
  if(!value)throw Error("Missing required variable: "+name);
  return value;
};
const beta=need("VV_BETA_SUPABASE_URL");
const anon=need("VV_BETA_PUBLISHABLE_KEY");
const email=need("VV_BETA_TEST_EMAIL");
const password=need("VV_BETA_TEST_PASSWORD");
const origin=new URL(beta);
if(origin.protocol!=="https:"||!/^[a-z0-9-]+\.supabase\.co$/.test(origin.hostname)||
   origin.pathname!=="/"||origin.search||origin.hash||origin.username||origin.password||
   origin.origin!==beta.replace(/\/$/,""))
  throw Error("Only a bare Supabase HTTPS project origin is supported");
if(process.env.VV_BETA_CONFIRM_TEST_MODE!=="I_UNDERSTAND_THIS_IS_TEST_ONLY")
  throw Error("Confirm this is an isolated TEST MODE Supabase environment");
const parsed=async res=>res.json().catch(()=>({}));
async function request(url,opts={},timeout=15000){
  const res=await fetch(url,{...opts,signal:AbortSignal.timeout(timeout)});
  return {http:res.status,body:await parsed(res)};
}
const headers={apikey:anon,"Content-Type":"application/json"};
const auth=await request(beta+"/auth/v1/token?grant_type=password",{
  method:"POST",headers,body:JSON.stringify({email,password})
});
if(auth.http!==200||typeof auth.body?.access_token!=="string")
  throw Error("Cannot authenticate test user; check confirmed email and beta credentials");
const authed={...headers,Authorization:"Bearer "+auth.body.access_token};
const billing=action=>request(beta+"/functions/v1/vv-billing",{
  method:"POST",headers:authed,body:JSON.stringify({action})
});
const market=()=>request(beta+"/functions/v1/vv-market",{method:"GET",headers:authed},30000);
const status=await billing("status");
if(status.http!==200||status.body?.mode!=="test")
  throw Error("Expected billing status HTTP 200 and test environment; got HTTP "+status.http);
const expectedPaid=phase==="paid";
if(Boolean(status.body.active)!==expectedPaid)
  throw Error("Payment state did not match "+phase+"; inspect webhook receipts and subscription ledger");
const premium=await market();
if(expectedPaid&&premium.http===402)
  throw Error("Premium market endpoint still denies a verified paid beta account");
if(!expectedPaid&&premium.http!==402)
  throw Error("Unpaid beta user was not rejected with 402; got HTTP "+premium.http);
if(phase==="preflight"){
  const forged=await request(beta+"/functions/v1/vv-stripe-webhook",{
    method:"POST",
    headers:{"Content-Type":"application/json","stripe-signature":"t=1,v1="+"0".repeat(64)},
    body:JSON.stringify({id:"evt_forgedtest",type:"invoice.paid",livemode:false,data:{object:{subscription:"sub_fake"}}})
  });
  if(forged.http!==400)throw Error("Webhook did not reject bogus signature; got HTTP "+forged.http);
}
if(phase==="checkout"){
  if(status.body.billing_ready!==true)throw Error("Stripe TEST billing is not configured");
  const created=await billing("checkout");
  if(created.http!==200||typeof created.body?.url!=="string")
    throw Error("Unable to create Stripe TEST checkout; HTTP "+created.http);
  const url=new URL(created.body.url);
  if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")
    throw Error("Untrusted Stripe checkout redirect");
  process.stdout.write("Private TEST checkout URL: "+url.href+"\n");
}
process.stdout.write(JSON.stringify({
  phase,result:"PASS",mode:status.body.mode,
  active:status.body.active,premium_http:premium.http,
  ...(phase==="preflight"?{forged_webhook_rejected:true}:{})
},null,2)+"\n");
