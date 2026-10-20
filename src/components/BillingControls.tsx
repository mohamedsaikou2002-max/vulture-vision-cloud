import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
export default function BillingControls(){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const requestId=useRef<string|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{
  const [{data:config,error:configError},{data,error:statusError}]=await Promise.all([supabase.functions.invoke('vv-billing',{body:{action:'config'}}),supabase.functions.invoke('vv-billing',{body:{action:'status'}})]);
  if(active){setEnabled(!configError&&!statusError&&config?.enabled===true);setStatus(data?.subscription?.status||'');if(configError||statusError)setError('Billing status is unavailable. No payment has been started.');else setError('');}
 };void load();const timer=setInterval(()=>void load(),15000);return()=>{active=false;clearInterval(timer);};},[]);
 const start=async(action:'checkout'|'portal')=>{
  setBusy(true);setError('');
  try{
   if(!requestId.current)requestId.current=crypto.randomUUID();
   const {data,error}=await supabase.functions.invoke('vv-billing',{body:{action,request_id:requestId.current}});
   if(error||typeof data?.url!=='string')throw new Error('Billing could not be confirmed. Retry or contact support.');
   const url=new URL(data.url);if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('Invalid billing redirect');
   window.location.assign(url.href);
  }catch(e){setError(e instanceof Error?e.message:'Billing unavailable');setBusy(false);}
 };
 const existing=['active','trialing','past_due','unpaid','incomplete'].includes(status);
 return <div className="billing-controls"><p className="signed-in-note">{status?'Subscription: '+status.replace(/_/g,' '):'No confirmed subscription yet'}</p><Button disabled={!enabled||busy} size="lg" onClick={()=>void start(existing?'portal':'checkout')}>{busy?'Opening Stripe…':!enabled?'Checkout not configured':existing?'Manage billing & invoices':'Start seven-day introduction'}</Button>{error&&<p role="alert">{error}</p>}</div>;
}
