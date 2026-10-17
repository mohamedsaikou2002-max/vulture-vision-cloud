import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type AuthMode = "signin" | "register" | "reset";
interface BillingStatus { active: boolean; mode: "test" | "live" | "unconfigured"; billing_ready: boolean; state: string; }
const RELEASE_CHANNEL = import.meta.env.VITE_RELEASE_CHANNEL === "commercial" ? "commercial" : "beta";

async function billingOperation(action: "status" | "checkout" | "portal"): Promise<BillingStatus & {url?:string}> {
  const { data, error } = await supabase.functions.invoke("vv-billing", { body: { action } });
  if (error) {
    let message = error.message || "Billing request failed";
    const context = (error as typeof error & { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const detail = await context.json();
        if (typeof detail?.error === "string") message = detail.error;
      } catch { /* Preserve original error. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as BillingStatus & { url?: string };
}
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
      if (!s) setBilling(null);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session); setReady(true); }
    }).catch(() => mounted && setReady(true));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  const refreshBilling = useCallback(async () => {
    setChecking(true);
    try { setBilling(await billingOperation("status")); setErr(""); }
    catch (e) { setBilling(null); setErr(e instanceof Error ? e.message : "Could not verify subscription"); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    if (!session || recovering) return;
    void refreshBilling();
    const t = setInterval(() => { void refreshBilling(); }, 15_000);
    return () => clearInterval(t);
  }, [session?.user.id, recovering, refreshBilling]);
  const signOut = async () => {
    setErr(""); await supabase.auth.signOut(); setBilling(null); setSession(null);
  };
  const oauth = async () => {
    setErr(""); setWorking(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
    } catch(e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };
  const passwordAuth = async (event: FormEvent) => {
    event.preventDefault(); setWorking(true); setErr(""); setNote("");
    try {
      if (recovering) {
        if (password.length < 12) throw new Error("Use at least 12 characters for a new password");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovering(false); setNote("Password updated.");
        return;
      }
      if (authMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNote("If an account exists, password-reset instructions have been sent.");
      } else if (authMode === "register") {
        if (password.length < 12) throw new Error("Use a password with at least 12 characters");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setNote("Account created. Check your inbox and confirm your email before subscribing.");
        setAuthMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch(e) { setErr(e instanceof Error ? e.message : "Account request failed"); }
    finally { setWorking(false); }
  };
  const goStripe = async (action: "checkout" | "portal") => {
    setWorking(true); setErr("");
    try {
      const result = await billingOperation(action);
      if (!result.url) throw new Error("Stripe did not return a checkout URL");
      const hosted = new URL(result.url);
      const expected = action === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
      if (hosted.protocol !== "https:" || hosted.hostname !== expected) throw new Error("Unexpected payment link");
      window.location.assign(result.url);
    } catch(e) { setErr(e instanceof Error ? e.message : "Stripe is not configured"); }
    finally { setWorking(false); }
  };

  if (!ready) return <div role="status" className="min-h-screen grid place-items-center bg-background text-foreground">Verifying account…</div>;
  if (!session || recovering) return (
    <main className="min-h-screen flex items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-primary/30 bg-background/95 p-7">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-[.18em] text-primary">VULTURE VISION</h1>
          <p className="text-sm text-muted-foreground">{recovering ? "Choose a new account password" : "Secure research account · " + (RELEASE_CHANNEL === "beta" ? "Beta" : "Commercial")}</p>
        </div>
        {!recovering && <button type="button" disabled={working} onClick={() => void oauth()}
          className="w-full rounded border border-primary px-4 py-3 text-sm text-primary hover:bg-primary/10 disabled:opacity-50">
          CONTINUE WITH GOOGLE
        </button>}
        {!recovering && <div className="text-center text-xs text-muted-foreground">Or use email and password</div>}
        <form onSubmit={passwordAuth} className="space-y-4">
          {!recovering && <label className="block text-xs text-muted-foreground">Email
            <input aria-label="Email" type="email" autoComplete="email" required maxLength={254}
              className="mt-1 w-full rounded border border-border bg-background p-3 text-sm text-foreground" value={email} onChange={e => setEmail(e.target.value)}/>
          </label>}
          {authMode !== "reset" || recovering ? <label className="block text-xs text-muted-foreground">Password
            <input aria-label="Password" type="password" required minLength={authMode === "register" || recovering ? 12 : 1}
              autoComplete={recovering ? "new-password" : authMode === "register" ? "new-password" : "current-password"}
              className="mt-1 w-full rounded border border-border bg-background p-3 text-sm text-foreground" value={password} onChange={e => setPassword(e.target.value)}/>
          </label> : null}
          <button type="submit" disabled={working}
            className="w-full rounded bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {working ? "PLEASE WAIT…" : recovering ? "UPDATE PASSWORD" : authMode === "register" ? "CREATE ACCOUNT" : authMode === "reset" ? "SEND RESET LINK" : "SIGN IN"}
          </button>
        </form>
        {!recovering && <div className="flex justify-between gap-3 text-xs text-primary">
          <button type="button" onClick={()=>setAuthMode(authMode==="register"?"signin":"register")}>
            {authMode==="register" ? "Already registered?" : "Create account"}
          </button>
          <button type="button" onClick={()=>setAuthMode(authMode==="reset"?"signin":"reset")}>
            {authMode==="reset" ? "Back to sign-in" : "Forgot password?"}
          </button>
        </div>}
        {note && <p role="status" className="text-sm text-primary">{note}</p>}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <p className="text-center text-xs leading-relaxed text-muted-foreground">Your account is managed by Supabase authentication. Paid research features require a confirmed Stripe subscription.</p>
      </div>
    </main>
  );

  if (billing?.active && (billing.mode === (RELEASE_CHANNEL === "beta" ? "test" : "live"))) return <>{children}</>;
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-5 text-foreground">
      <div className="w-full max-w-lg space-y-5 rounded-xl border border-primary/40 p-8">
        <h1 className="text-2xl font-bold tracking-[.14em] text-primary">VULTURE VISION</h1>
        <h2 className="text-lg font-semibold">{RELEASE_CHANNEL === "beta" ? "Founding Beta Access" : "Commercial Subscription"}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This research workspace requires a verified, paid subscription. Account creation is free;
          market intelligence, simulations and AI tools stay locked until Stripe confirms payment.
        </p>
        {RELEASE_CHANNEL === "beta" && <p className="rounded border border-primary/30 bg-primary/5 p-3 text-xs">
          BETA / TEST MODE · Use only Stripe test checkout. No real money is charged. This release must connect to a separate test Supabase project.
        </p>}
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-semibold">{RELEASE_CHANNEL === "beta" ? "Founding Trader Beta" : "Vulture Vision Pro"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Your final amount, any applicable taxes and renewal details appear in Stripe Checkout.</p>
        </div>
        {!billing && <p role="status" className="text-sm text-muted-foreground">Verifying your subscription…</p>}
        {billing && !billing.billing_ready && <p role="alert" className="text-sm text-destructive">Billing is not configured for this environment. No payments can be accepted yet.</p>}
        {billing?.billing_ready && <button type="button" disabled={working || checking}
          onClick={() => void goStripe("checkout")}
          className="w-full rounded bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {working ? "REDIRECTING…" : RELEASE_CHANNEL === "beta" ? "CONTINUE TO TEST CHECKOUT" : "SUBSCRIBE SECURELY"}
        </button>}
        <div className="flex flex-wrap items-center gap-4 text-sm text-primary">
          <button type="button" disabled={checking} onClick={() => void refreshBilling()}>Refresh payment status</button>
          <button type="button" disabled={working} onClick={() => void goStripe("portal")}>Manage existing billing</button>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          A successful redirect does not unlock access. We wait for a verified Stripe invoice event.
          Cancel future renewals through the billing portal.
        </p>
      </div>
    </main>
  );
}
