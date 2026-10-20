/** Server-only billing: explicit activation, pinned API, no client-supplied amounts or IDs. */
export const BILLING_OFFER={currency:'usd',introCents:9900,monthlyCents:105000,days:7} as const;
export const STRIPE_VERSION='2025-02-24.acacia';
export async function stripeRequest(key:string,path:string,params?:URLSearchParams,idempotency?:string){
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_VERSION,...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body:params,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(`Stripe request failed (HTTP ${response.status})`);
 return response.json();
}
export async function signedStripeEvent(raw:string,signature:string,secret:string,now=Date.now()){
 const parts=signature.split(',').map(v=>v.trim().split('='));
 const timestamp=parts.find(([key])=>key==='t')?.[1];
 if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw new Error('Invalid signature timestamp');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw)));
 const expected=Array.from(mac,v=>v.toString(16).padStart(2,'0')).join('');
 const matches=parts.filter(([key])=>key==='v1').some(([,value])=>{if(!value||value.length!==expected.length)return false;let diff=0;for(let i=0;i<value.length;i++)diff|=value.charCodeAt(i)^expected.charCodeAt(i);return diff===0;});
 if(!matches)throw new Error('Invalid signature');
 const event=JSON.parse(raw);if(typeof event.id!=='string'||!Number.isInteger(event.created)||typeof event.type!=='string'||!event.data?.object)throw new Error('Invalid Stripe event');return event;
}
export async function boundedBody(req:Request,max=262144){
 const reader=req.body?.getReader();if(!reader)return '';const parts:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error('Body too large');}parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function checkoutParameters(customer:string,user:string,monthly:string,intro:string,origin:string,expires:number){
 return new URLSearchParams({customer,mode:'subscription','line_items[0][price]':monthly,'line_items[0][quantity]':'1','line_items[1][price]':intro,'line_items[1][quantity]':'1','subscription_data[trial_period_days]':String(BILLING_OFFER.days),'subscription_data[metadata][supabase_user_id]':user,'subscription_data[metadata][intro_price_id]':intro,'metadata[supabase_user_id]':user,'client_reference_id':user,'custom_text[submit][message]':'Pay $99 USD for seven days of introductory access, then $1,050 USD per month until canceled. Manage billing in your account.',payment_method_collection:'always','payment_method_types[0]':'card',success_url:origin+'/welcome?billing=success',cancel_url:origin+'/welcome?billing=cancelled',expires_at:String(expires)});
}
export function subscriptionState(subscription:Record<string,unknown>,monthlyPrice:string){
 const s=subscription as {id:string;customer:string|{id:string};status:string;items?:{data:{price:{id:string};current_period_end?:number}[]};current_period_end?:number;trial_end?:number;cancel_at_period_end?:boolean;latest_invoice?:{paid?:boolean;amount_paid?:number};metadata?:Record<string,string>};
 const price=s.items?.data.find(item=>item.price.id===monthlyPrice);
 if(!price)throw new Error('Subscription price does not match configured membership');
 const paid=s.latest_invoice?.paid===true;
 const entitled=s.status==='active'?paid:s.status==='trialing'?paid&&Number(s.latest_invoice?.amount_paid)>=BILLING_OFFER.introCents:false;
 const period=s.current_period_end||price.current_period_end||s.trial_end;
 if(!Number.isFinite(period))throw new Error('Missing subscription period');
 return {subscription:s.id,customer:typeof s.customer==='string'?s.customer:s.customer.id,status:entitled?s.status:['active','trialing'].includes(s.status)?'incomplete':s.status,period_end:new Date(Number(period)*1000).toISOString(),trial_end:s.trial_end?new Date(s.trial_end*1000).toISOString():null,cancel_at_period_end:!!s.cancel_at_period_end,price:monthlyPrice};
}
