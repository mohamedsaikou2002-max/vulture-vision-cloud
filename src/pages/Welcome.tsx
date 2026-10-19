import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { MEMBERSHIP } from "@/lib/membership";

export default function Welcome() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    <section className="welcome-heading"><span className="section-index">02 — THE PERSPECTIVE</span><h1>Vulture Vision.<br /><span>See the bigger picture.</span></h1><p>Market intelligence for people who make their own decisions.</p></section>
    <section className="welcome-capabilities">{[
      ["01", "Intelligence, connected", "Market signals, news, and on-chain context in one research workspace."],
      ["02", "Scenarios, explored", "Socio-economic research and scenario analysis to examine what could happen next."],
      ["03", "Capital, considered", "A wider lens for allocation and risk. Your judgment stays at the center—never automated trading."],
    ].map(([n, title, copy]) => <article key={n}><span>{n}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
    <section className="membership-section" id="membership"><div><span className="section-index">03 — MEMBERSHIP</span><h2>Your next<br />vantage point.</h2><p>Built by Grey Company. Developed with 400+ beta day traders, and used by hedge funds and capital management firms to inform capital allocation and management.</p><small>Research support, not investment advice. No guaranteed outcomes.</small></div>
      <div className="membership-offer"><span className="section-index">VULTURE VISION MEMBERSHIP</span><div className="membership-price">${MEMBERSHIP.amountCents / 100}<span>USD / month</span></div><p>Recurring monthly membership</p><ul>{["Market intelligence & analytics", "News and socio-economic context", "Scenario research workspace"].map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
      {!signedIn ? <Button onClick={signIn} disabled={busy} size="lg">{busy ? <Loader2 className="animate-spin" /> : <span className="google-letter">G</span>}Continue with Google</Button> : <><p className="signed-in-note"><Check size={15} /> Google account connected</p><Button disabled size="lg">Subscription checkout not configured</Button><Button asChild variant="link"><Link to="/dashboard">Open existing workspace <ArrowUpRight /></Link></Button></>}
      {!signedIn && <small>Sign in to connect your membership.</small>}<p className="payment-note">Payments are not yet enabled. No payment is taken here.</p>{error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </section>
  </main></PublicShell>;
}