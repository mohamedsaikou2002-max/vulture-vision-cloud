import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {BILLING_OFFER,boundedBody,checkoutParameters,stripeRequest} from '../_shared/stripe_billing.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const key=Deno.env.get('STRIPE_SECRET_KEY'),monthly=Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),intro=Deno.env.get('STRIPE_TRIAL_SETUP_PRICE_ID'),origin=Deno.env.get('FRONTEND_URL');
 try{
  const body=JSON.parse(await boundedBody(req,2048));
  const enabled=Deno.env.get('BILLING_ENABLED')==='true'&&!!key&&!!monthly&&!!intro&&!!origin;
  if(body.action==='config')return reply({enabled,offer:BILLING_OFFER});
  const authorization=req.headers.get('authorization')||'';
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply({error:'Sign in to manage billing'},401);
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if(body.action==='status'){
   const {data,error}=await sb.from('subscriptions').select('status,current_period_end,trial_end,cancel_at_period_end').eq('user_id',user.id).maybeSingle();if(error)throw new Error('Billing schema unavailable');const {data:access,error:accessError}=await sb.rpc('vv_workspace_access',{p_user_id:user.id});if(accessError)throw new Error('Entitlement verification unavailable');return reply({subscription:data,workspace_access:access===true});
  }
  if(!enabled)return reply({error:'Billing is not configured. No payment was created.'},503);
  const url=new URL(origin!);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Configure a valid HTTPS FRONTEND_URL origin');
  const {data:customerRow,error:customerError}=await sb.from('billing_customers').select('stripe_customer_id').eq('user_id',user.id).maybeSingle();if(customerError)throw new Error('Billing schema unavailable');
  if(body.action==='portal'){
   if(!customerRow)return reply({error:'No billing account exists yet'},409);
   const portal=await stripeRequest(key!,'billing_portal/sessions',new URLSearchParams({customer:customerRow.stripe_customer_id,return_url:url.origin+'/welcome'}));return reply({url:portal.url});
  }
  if(body.action!=='checkout')return reply({error:'Unknown billing action'},400);
  if(typeof body.request_id!=='string'||!(/^[a-f0-9-]{36}$/i).test(body.request_id))return reply({error:'A request ID is required'},400);
  if(customerRow){const existing=await stripeRequest(key!,'subscriptions?'+new URLSearchParams({customer:customerRow.stripe_customer_id,status:'all',limit:'100'}));if(existing.has_more||existing.data?.some((s:{status:string})=>!['canceled','incomplete_expired'].includes(s.status)))return reply({error:'Manage your existing subscription in the billing portal'},409);}
  const [mp,ip]=await Promise.all([stripeRequest(key!,'prices/'+encodeURIComponent(monthly!)),stripeRequest(key!,'prices/'+encodeURIComponent(intro!))]);
  if(mp.unit_amount!==BILLING_OFFER.monthlyCents||mp.currency!=='usd'||mp.recurring?.interval!=='month'||mp.recurring?.interval_count!==1||mp.active!==true||ip.unit_amount!==BILLING_OFFER.introCents||ip.currency!=='usd'||ip.type!=='one_time'||ip.active!==true||mp.livemode!==ip.livemode)throw new Error('Configured Stripe prices do not match the displayed offer');
  const {data:attempt,error:claimError}=await sb.rpc('vv_claim_checkout',{p_user_id:user.id,p_request_id:body.request_id});if(claimError)throw new Error('Checkout claim unavailable');if(!attempt)return reply({error:'An existing subscription requires billing portal management'},409);
  let customer=customerRow?.stripe_customer_id;
  if(!customer){const created=await stripeRequest(key!,'customers',new URLSearchParams({'metadata[supabase_user_id]':user.id,...(user.email?{email:user.email}:{})}),'customer-'+user.id);customer=created.id;const {error}=await sb.from('billing_customers').upsert({user_id:user.id,stripe_customer_id:customer});if(error)throw new Error('Customer mapping could not be saved');}
  const session=await stripeRequest(key!,'checkout/sessions',checkoutParameters(customer,user.id,monthly!,intro!,url.origin,Math.floor(Date.parse(attempt.expires_at)/1000)),'checkout-'+attempt.request_id);
  return reply({url:session.url});
 }catch(error){console.error('billing_error',error instanceof Error?error.message:'Billing failed');return reply({error:'Billing could not be confirmed. Retry the same request or contact support; do not assume payment succeeded.'},503);}
});
