import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AuthGate({ children }: { children?: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (session) return <>{children ?? <Outlet />}</>;

  const signIn = async () => {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setErr(String((r.error as Error).message ?? r.error));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm border border-border p-8 text-center space-y-6">
        <h1 className="text-2xl tracking-widest font-bold" style={{ fontFamily: "Orbitron, sans-serif" }}>VULTURE VISION</h1>
        <p className="text-sm text-muted-foreground">Sign in to access the intelligence terminal.</p>
        <Button variant="outline" onClick={signIn} className="w-full border-primary text-primary">
          SIGN IN WITH GOOGLE
        </Button>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    </div>
  );
}
