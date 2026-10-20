import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {boundedBody,signedStripeEvent,stripeRequest,subscriptionState} from '../_shared/stripe_billing.ts';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET'),key=Deno.env.get('STRIPE_SECRET_KEY'),price=Deno.env.get('STRIPE_MONTHLY_PRICE_ID');
 if(!secret||!key||!price)return reply({error:'Webhook configuration unavailable'},503);
 let event;
 try{event=await signedStripeEvent(await boundedBody(req),req.headers.get('stripe-signature')||'',secret);}catch{return reply({error:'Invalid webhook signature or payload'},400);}
 const supported=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed'];
 if(!supported.includes(event.type))return reply({received:true,ignored:true});
 try{
  const object=event.data.object;
  const subscriptionId=event.type.startsWith('customer.subscription.')?object.id:typeof object.subscription==='string'?object.subscription:object.subscription?.id;
  if(!subscriptionId)return reply({received:true,ignored:true});
  // Retrieve authoritative current Stripe state instead of trusting old delivery order.
  const subscription=await stripeRequest(key,'subscriptions/'+encodeURIComponent(subscriptionId)+'?expand[]=latest_invoice');
  if(!subscription.metadata?.supabase_user_id || !subscription.items?.data?.some((item:{price:{id:string}})=>item.price.id===price))return reply({received:true,ignored:true});
  const snapshot=subscriptionState(subscription,price);
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:customer,error}=await sb.from('billing_customers').select('user_id').eq('stripe_customer_id',snapshot.customer).maybeSingle();
  if(error||!customer||subscription.metadata?.supabase_user_id!==customer.user_id)throw new Error('Customer ownership could not be verified');
  const {error:writeError}=await sb.rpc('vv_apply_billing_event',{p_event_id:event.id,p_created:event.created,p_user_id:customer.user_id,p_snapshot:snapshot});
  if(writeError)throw new Error('Billing update failed');return reply({received:true});
 }catch(error){console.error('stripe_webhook_sync_failed',error instanceof Error?error.message:'Sync failed');return reply({error:'Subscription synchronization failed; retry delivery'},500);}
});
