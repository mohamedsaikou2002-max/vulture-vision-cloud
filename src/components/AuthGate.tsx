import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
export default function AuthGate({children}:{children?:ReactNode}){
 const [state,setState]=useState<'loading'|'allowed'|'signin'|'error'>('loading');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;let revision=0;
  const check=async()=>{const current=++revision;try{
   const {data:{session}}=await supabase.auth.getSession();
   if(alive&&current===revision)setState(session?'allowed':'signin');
  }catch{if(alive&&current===revision)setState('error');}};
  void check();const {data:listener}=supabase.auth.onAuthStateChange(()=>{queueMicrotask(()=>void check());});
  // Temporary signed-in testing; premium server requests still independently authorize.
  window.addEventListener('focus',check);const timer=setInterval(()=>void check(),60000);
  return()=>{alive=false;revision++;clearInterval(timer);listener.subscription.unsubscribe();window.removeEventListener('focus',check);};
 },[retry]);
 if(state==='allowed')return <>{children??<Outlet/>}</>;
 return <div className="belicia-workspace min-h-screen flex items-center justify-center p-6"><div className="max-w-md border border-border p-8 space-y-6"><h1>VULTURE VISION</h1><p role="status">{state==='loading'?'Verifying sign-in…':state==='error'?'Sign-in verification is unavailable. Please retry.':'Sign in to open the workspace.'}</p>{state!=='loading'&&<Button asChild><Link to="/welcome#membership">Sign in</Link></Button>}{state==='error'&&<Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry verification</Button>}<p><Link to="/welcome">Account and billing</Link></p></div></div>;
}
