import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/PublicShell";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Open the recovery link from your email before changing your password.");
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) throw failure;
      navigate("/account", { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reset password."); }
    finally { setBusy(false); }
  }
  return <PublicShell><main className="min-h-screen grid place-items-center p-6">
    <section className="max-w-md w-full border rounded-xl p-8 space-y-5">
      <h1 className="text-2xl">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">New password<input className="w-full border rounded p-3 bg-background" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}/></label>
        <Button type="submit" disabled={busy}>Change password</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <Link to="/login">Sign in</Link>
    </section>
  </main></PublicShell>;
}
