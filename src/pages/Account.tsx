import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import VVLayout from '@/components/VVLayout';
import BillingControls from '@/components/BillingControls';
import {Button} from '@/components/ui/button';
import {supabase} from '@/integrations/supabase/client';
export default function Account(){
 const [email,setEmail]=useState<string|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);const navigate=useNavigate();
 useEffect(()=>{let active=true;void supabase.auth.getUser().then(({data,error})=>{if(active){setEmail(error?null:data.user?.email||null);setReady(true);if(error)setError('Your account could not be verified. Sign in again.');}}).catch(()=>{if(active){setReady(true);setError('Account verification is unavailable.');}});return()=>{active=false;};},[]);
 const signOut=async()=>{setBusy(true);setError('');try{const {error}=await supabase.auth.signOut();if(error)throw error;navigate('/welcome');}catch{setError('Sign-out failed. Please retry.');}finally{setBusy(false);}};
 return <VVLayout><section className="account-page"><h1>ACCOUNT &amp; BILLING</h1><p>Manage your existing membership through the secure Stripe customer portal.</p>{!ready?<p role="status">Verifying account…</p>:email?<section className="panel space-y-5"><h2 className="panel-title">YOUR ACCOUNT</h2><p className="break-all">{email}</p><BillingControls/><p>Payment status is verified by the backend. No card or payment details are stored in this page.</p><Button variant="outline" disabled={busy} onClick={()=>void signOut()}>{busy?'Signing out…':'SIGN OUT'}</Button></section>:<Button asChild><Link to="/welcome#membership">Sign in to manage your account</Link></Button>}{error&&<p role="alert">{error}</p>}</section></VVLayout>;
}
