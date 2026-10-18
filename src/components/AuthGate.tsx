import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

declare global {
  interface Window {
    VultureAndroid?: {
      openExternal(url: string): void;
      consumeAuthCallback(): string;
    };
  }
}
const MOBILE_CALLBACK = "vulturevision://auth/callback";

function extractTokens(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "vulturevision:" || parsed.host !== "auth" || parsed.pathname !== "/callback")
    throw new Error("Unrecognized authentication callback");
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    error: params.get("error_description") || parsed.searchParams.get("error_description"),
    code: parsed.searchParams.get("code"),
  };
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession()
      .then(({ data }) => { setSession(data.session); setReady(true); })
      .catch((e: unknown) => { setErr(String(e)); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!window.VultureAndroid) return;
    let active = true;
    const onAuthCallback = async (event: Event) => {
      try {
        const url = (event as CustomEvent<string>).detail;
        const payload = extractTokens(url);
        if (payload.error) throw new Error(payload.error);
        if (payload.access_token && payload.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          });
          if (error) throw error;
        } else if (payload.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(payload.code);
          if (error) throw error;
        } else throw new Error("No auth session returned. Check provider redirect settings.");
        if (active) setErr(null);
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    window.addEventListener("vv-auth-callback", onAuthCallback);
    // Handles a deep link that launched a cold Android process.
    const pending = window.VultureAndroid.consumeAuthCallback();
    if (pending) window.dispatchEvent(new CustomEvent("vv-auth-callback", { detail: pending }));
    return () => { active = false; window.removeEventListener("vv-auth-callback", onAuthCallback); };
  }, []);

  if (!ready) return null;
  if (session) return <>{children}</>;

  const signIn = async () => {
    setErr(null);
    try {
      if (window.VultureAndroid) {
        // Native sign-in must leave Android WebView: Google blocks embedded OAuth user agents.
        // Set vulturevision://auth/callback in Supabase Auth's redirect allow-list
        // and enable Google under Supabase Authentication > Providers.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: MOBILE_CALLBACK, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Provider did not supply a login URL");
        window.VultureAndroid.openExternal(data.url);
        return;
      }
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) throw r.error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm border border-border p-8 text-center space-y-6">
        <h1 className="text-2xl tracking-widest font-bold" style={{ fontFamily: "Orbitron, sans-serif" }}>VULTURE VISION</h1>
        <p className="text-sm text-muted-foreground">Sign in to access the intelligence terminal.</p>
        <button onClick={signIn} className="w-full border border-primary text-primary py-3 tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors">
          SIGN IN WITH GOOGLE
        </button>
        {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      </div>
    </div>
  );
}
