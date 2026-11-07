import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/PublicShell";

type Mode = "login" | "signup" | "reset";
export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "reset") {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (failure) throw failure;
        setNotice("If an account exists for that email, a recovery link will be sent.");
      } else if (mode === "signup") {
        const { data, error: failure } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/account" } });
        if (failure) throw failure;
        if (data.session) navigate("/account", { replace: true });
        else setNotice("Check your inbox to confirm your account before signing in.");
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email, password });
        if (failure) throw failure;
        navigate("/account", { replace: true });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication unavailable."); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError("");
    const { error: failure } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/account" } });
    if (failure) { setError(failure.message); setBusy(false); }
  };
  return <PublicShell><main className="min-h-screen flex items-center justify-center p-6">
    <section className="w-full max-w-md border rounded-xl border-border p-8 space-y-5" aria-label="Vulture Vision sign-in">
      <h1 className="text-2xl font-bold tracking-wide">{mode === "signup" ? "Create an account" : mode === "reset" ? "Reset password" : "Sign in"}</h1>
      <p className="text-sm text-muted-foreground">Vulture Vision by Grey Company. Sign in to manage your subscription.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Email address<input className="mt-1 w-full rounded border bg-background p-3 text-foreground" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {mode !== "reset" && <label className="block text-sm">Password<input className="mt-1 w-full rounded border bg-background p-3 text-foreground" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Processing…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send recovery link" : "Sign in"}</Button>
      </form>
      {mode !== "reset" && <Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continue with Google</Button>}
      <div className="text-sm flex flex-wrap gap-4">
        <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}>{mode === "signup" ? "Already registered? Sign in" : "Create account"}</button>
        <button type="button" onClick={() => { setMode(mode === "reset" ? "login" : "reset"); setError(""); setNotice(""); }}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <Link className="text-sm underline" to="/welcome">Back to membership details</Link>
    </section>
  </main></PublicShell>;
}
