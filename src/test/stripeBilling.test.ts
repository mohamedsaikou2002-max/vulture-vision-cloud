import {webcrypto} from 'node:crypto';
import {transferableAbortController} from 'node:util';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {signedStripeEvent,checkoutParameters,subscriptionState,BILLING_OFFER} from '../../supabase/functions/_shared/stripe_billing';
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);});
afterEach(()=>vi.unstubAllGlobals());
async function sign(raw:string,timestamp:number){const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode('fixture-webhook-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw))),v=>v.toString(16).padStart(2,'0')).join('');}
it('checks the raw signature, tolerates secret rotation signatures, and rejects replay/tampering',async()=>{
 const now=Date.now(),t=Math.floor(now/1000),raw=JSON.stringify({id:'evt_1',created:t,type:'invoice.paid',data:{object:{id:'invoice_1'}}});
 const signature=await sign(raw,t);
 expect((await signedStripeEvent(raw,`t=${t},v1=invalid,v1=${signature}`,'fixture-webhook-secret',now)).id).toBe('evt_1');
 await expect(signedStripeEvent(raw+' ',`t=${t},v1=${signature}`,'fixture-webhook-secret',now)).rejects.toThrow();
 await expect(signedStripeEvent(raw,`t=${t},v1=${signature}`,'fixture-webhook-secret',now+301000)).rejects.toThrow('timestamp');
});
it('uses the supported one-time Checkout line item and links the authenticated user',()=>{
 const params=checkoutParameters('cus_1','user_1','price_month','price_intro','https://example.com',2000000000);
 expect(params.get('line_items[1][price]')).toBe('price_intro');expect(params.has('subscription_data[add_invoice_items][0][price]')).toBe(false);
 expect(params.get('subscription_data[metadata][supabase_user_id]')).toBe('user_1');expect(params.get('subscription_data[trial_period_days]')).toBe('7');expect(BILLING_OFFER.introCents).toBe(9900);
});
it('requires confirmed introductory payment and the configured price before granting trial access',()=>{
 const base={id:'sub_1',customer:'cus_1',status:'trialing',current_period_end:2000000000,items:{data:[{price:{id:'price_month'}}]},latest_invoice:{paid:false,amount_paid:0}};
 expect(subscriptionState(base,'price_month').status).toBe('incomplete');
 expect(subscriptionState({...base,latest_invoice:{paid:true,amount_paid:9900}},'price_month').status).toBe('trialing');
 expect(()=>subscriptionState(base,'different_price')).toThrow('price');
 expect(subscriptionState({...base,status:'past_due'},'price_month').status).toBe('past_due');
});
it('keeps checkout inactive without explicit activation and never contacts Stripe',async()=>{
 const {loadEdgeHandler}=await import('./helpers/edgeHarness');
 const fetcher=vi.fn();const handler=loadEdgeHandler('vv-billing',fetcher,{},()=>({auth:{getUser:async()=>({data:{user:{id:'fixture'}},error:null})}}));
 const config=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'config'})}));expect((await config.json()).enabled).toBe(false);
 const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'checkout',request_id:'00000000-0000-4000-8000-000000000001'})}));expect(result.status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
});
it('requires an authenticated customer before any checkout provider calls',async()=>{
 const {loadEdgeHandler}=await import('./helpers/edgeHarness');const fetcher=vi.fn();
 const handler=loadEdgeHandler('vv-billing',fetcher,{BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'fixture',STRIPE_MONTHLY_PRICE_ID:'price_m',STRIPE_TRIAL_SETUP_PRICE_ID:'price_i',FRONTEND_URL:'https://example.com'},()=>({auth:{getUser:async()=>({data:{user:null},error:{message:'expired'}})}}));
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({action:'checkout',user_id:'forged'})}));expect(response.status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
});
it('syncs a real signed webhook through current Stripe state and the service-only RPC',async()=>{
 const {loadEdgeHandler}=await import('./helpers/edgeHarness');const user='00000000-0000-4000-8000-000000000001',t=Math.floor(Date.now()/1000);
 const raw=JSON.stringify({id:'evt_signed',created:t,type:'customer.subscription.updated',data:{object:{id:'sub_fixture'}}});
 const rpc=vi.fn(async()=>({error:null}));const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{user_id:user},error:null})};
 const provider=vi.fn(async()=>Response.json({id:'sub_fixture',customer:'cus_fixture',status:'trialing',current_period_end:t+604800,metadata:{supabase_user_id:user},items:{data:[{price:{id:'price_month'}}]},latest_invoice:{paid:true,amount_paid:9900}}));
 const handler=loadEdgeHandler('stripe-webhook',provider,{STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture-webhook-secret',STRIPE_MONTHLY_PRICE_ID:'price_month'},()=>({from:()=>query,rpc}));
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${await sign(raw,t)}`},body:raw}));
 expect(response.status).toBe(200);expect(rpc).toHaveBeenCalledWith('vv_apply_billing_event',expect.objectContaining({p_event_id:'evt_signed',p_user_id:user,p_snapshot:expect.objectContaining({status:'trialing',customer:'cus_fixture'})}));
 const rejected=await handler(new Request('https://fixture.invalid',{method:'POST',body:raw}));expect(rejected.status).toBe(400);expect(provider).toHaveBeenCalledTimes(1);
});
it('blocks premium member API calls before provider work when subscription enforcement is enabled',async()=>{
 const {loadEdgeHandler}=await import('./helpers/edgeHarness');const fetcher=vi.fn(),rpc=vi.fn(async()=>({data:false,error:null}));
 const handler=loadEdgeHandler('vv-chat',fetcher,{VV_REQUIRE_SUBSCRIPTION:'true',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'},()=>({auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},rpc}));
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer member-fixture'},body:JSON.stringify({message:'Explain Nasdaq risk'})}));
 expect(response.status).toBe(402);expect(rpc).toHaveBeenCalledWith('vv_autosim_has_access',{p_user_id:'member'});expect(fetcher).not.toHaveBeenCalled();
});
