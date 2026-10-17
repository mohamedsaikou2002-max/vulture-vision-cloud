import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";

interface BillingStatus { active:boolean;mode:string;billing_ready:boolean;state:string; }
export default function Account(){
  const [email,setEmail]=useState("");
  const [status,setStatus]=useState<BillingStatus|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(alive)setEmail(user?.email||"");
      const {data,error:e}=await supabase.functions.invoke("vv-billing",{body:{action:"status"}});
      if(!alive)return;
      if(e||data?.error)setError("Unable to verify billing status right now.");
      else setStatus(data as BillingStatus);
    })();
    return ()=>{alive=false;};
  },[]);
  const portal=async()=>{
    setLoading(true);setError("");
    try{
      const {data,error:e}=await supabase.functions.invoke("vv-billing",{body:{action:"portal"}});
      if(e||!data?.url)throw Error("Stripe portal is not available");
      const url=new URL(data.url);
      if(url.protocol!=="https:"||url.hostname!=="billing.stripe.com")
        throw Error("Unrecognized billing portal URL");
      window.location.assign(url.href);
    }catch(e){
      setError(e instanceof Error?e.message:"Billing portal unavailable");
    }finally{setLoading(false);}
  };
  const logOut=async()=>{
    setLoading(true);setError("");
    const {error:e}=await supabase.auth.signOut();
    if(e){setError("Could not sign out. Try again.");setLoading(false);}
  };
  return <VVLayout>
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-12 text-foreground">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-widest text-primary">ACCOUNT &amp; BILLING</h1>
        <p className="text-sm text-muted-foreground">Securely manage your Vulture Vision subscription.</p>
      </div>
      <section className="space-y-4 rounded-lg border border-border bg-background/90 p-6">
        <h2 className="text-lg font-semibold">Your account</h2>
        <p className="break-words text-sm text-muted-foreground">{email||"Loading verified account…"}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Subscription</span>
          <span className={status?.active?"text-primary":"text-destructive"} role="status">
            {!status?"Checking…":status.active?"ACTIVE":"NOT VERIFIED"}
          </span>
          {status&&<span className="text-xs text-muted-foreground">{status.mode==="test"?"Beta / test billing":"Commercial / live billing"}</span>}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cards and payment details are handled by Stripe. Manage or cancel recurring payments from its secure customer portal.
          Cancellation at the end of the term usually leaves access active until your paid-through date.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={()=>void portal()} disabled={loading||!status?.billing_ready}
            className="rounded border border-primary px-5 py-3 text-sm text-primary disabled:opacity-40">
            MANAGE STRIPE BILLING
          </button>
          <button type="button" onClick={()=>void logOut()} disabled={loading}
            className="rounded border border-border px-5 py-3 text-sm text-foreground disabled:opacity-40">
            SIGN OUT
          </button>
        </div>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </main>
  </VVLayout>;
}
