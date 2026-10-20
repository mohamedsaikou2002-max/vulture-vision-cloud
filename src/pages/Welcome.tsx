import PlatformShowcase from "@/components/PlatformShowcase";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import BillingControls from "@/components/BillingControls";
import { MEMBERSHIP } from "@/lib/membership";

export default function Welcome() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const location = useLocation();
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSignedIn(Boolean(session)); setBusy(false); });
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (location.hash === "#membership") document.getElementById("membership")?.scrollIntoView(); }, [location.hash]);
  const signIn = async () => {
    setBusy(true); setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/welcome` });
      if (result.error) throw result.error;
      if (!result.redirected) setBusy(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in could not be completed. Please try again."); setBusy(false); }
  };
  return <PublicShell><main className="welcome-main">
    <PlatformShowcase />
    <section className="membership-section" id="membership"><div><span className="section-index">03 — MEMBERSHIP</span><h2>Your next<br />vantage point.</h2><p>Market intelligence, scenario research and financial analytics alongside your trading terminal.</p><small>Research support, not investment advice. No guaranteed outcomes.</small></div>
      <div className="membership-offer"><span className="section-index">VULTURE VISION MEMBERSHIP</span><div className="membership-price">${MEMBERSHIP.amountCents / 100}<span>USD / month</span></div><p>Start with a ${(MEMBERSHIP.pilotAmountCents / 100).toFixed(2)} USD introduction for {MEMBERSHIP.trialHours / 24} days. Then ${MEMBERSHIP.amountCents / 100} USD/month, recurring.</p><ul>{["Market intelligence & analytics", "News and socio-economic context", "Scenario research workspace"].map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
      {!signedIn ? <><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin+'/welcome#membership'}});if(error)throw error;setSent(true);}catch{setError('Account email could not be sent. Retry or use the alternative sign-in.');}finally{setBusy(false);}}}><label htmlFor="membership-email">Account email</label><input id="membership-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /><Button disabled={busy} type="submit">{busy?'Connecting…':'Get Membership'}</Button></form>{sent&&<p role="status">Check your email for a secure account link, then continue to Stripe.</p>}<Button variant="outline" onClick={signIn} disabled={busy}>Continue with Google</Button></> : <><p className="signed-in-note"><Check size={15} /> Account connected</p><BillingControls /><Button asChild variant="link"><Link to="/dashboard">Open existing workspace <ArrowUpRight /></Link></Button></>}
      {!signedIn && <small>Sign in to connect your membership.</small>}<p className="payment-note">Checkout availability is verified by the billing service. Payments are processed by Stripe.</p>{error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </section>
  </main></PublicShell>;
}