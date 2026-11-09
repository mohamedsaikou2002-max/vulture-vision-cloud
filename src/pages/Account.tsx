import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VVLayout from "@/components/VVLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { billingAction, membershipStatus, MEMBERSHIP_OFFER, type BillingStatus } from "@/lib/billingApi";

export default function Account() {
  const [state, setState] = useState<BillingStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const refresh = useCallback(async () => {
    try { const [billing, user] = await Promise.all([membershipStatus(), supabase.auth.getUser()]);
      setState(billing); setEmail(user.data.user?.email || ""); setError("");
    } catch { setError("Unable to verify membership. Please try again."); }
  }, []);
  useEffect(() => { void refresh(); const onFocus = () => { void refresh(); }; window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [refresh]);
  const action = async (type: "checkout" | "portal") => {
    setBusy(true); setError("");
    try {
      const storageKey = "vv_checkout_request_id";
      const id = type === "checkout" ? (sessionStorage.getItem(storageKey) || crypto.randomUUID()) : undefined;
      if (type === "checkout" && id) sessionStorage.setItem(storageKey, id);
      const url = await billingAction(type, id);
      window.location.assign(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Billing unavailable."); setBusy(false); }
  };
  return <VVLayout><section className="account-page space-y-5"><h1>ACCOUNT & MEMBERSHIP</h1>
    <section className="panel space-y-4 p-6">
      <h2 className="panel-title">Account</h2><p>{email || "Signed in"}</p>
      <Button variant="outline" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
    </section>
    <section className="panel space-y-5 p-6">
      <h2 className="panel-title">Vulture Vision membership</h2>
      <p>${MEMBERSHIP_OFFER.introCents / 100} upfront for {MEMBERSHIP_OFFER.days} days; then ${MEMBERSHIP_OFFER.monthlyCents / 100}/month until canceled.</p>
      <p>Status: <strong>{state?.subscription?.status || "No subscription"}</strong></p>
      {state?.subscription?.current_period_end && <p>Access period ends: {new Date(state.subscription.current_period_end).toLocaleDateString()}</p>}
      {state?.entitled ? <><p>Your paid workspace is available.</p>
        <Button asChild><Link to="/dashboard">Open workspace</Link></Button>
        <Button variant="outline" disabled={busy || !state.enabled} onClick={() => void action("portal")}>Manage billing in Stripe</Button>
      </> : <>
        <p>Payments are processed by Stripe. Your membership becomes active after Stripe confirms payment through a signed webhook.</p>
        <Button disabled={busy || !state?.enabled} onClick={() => void action("checkout")}>{busy ? "Opening checkout…" : "Start membership — secure checkout"}</Button>
        {!state?.enabled && <p role="status">Checkout is not available until the billing configuration is verified.</p>}
      </>}
      <Button variant="outline" onClick={() => void refresh()} disabled={busy}>Refresh membership</Button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </section>
  </section></VVLayout>;
}
