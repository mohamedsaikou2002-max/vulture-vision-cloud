import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { membershipStatus } from "@/lib/billingApi";

/** UI convenience only: the Edge Functions and SQL RLS enforce the actual boundary. */
export default function MembershipGate() {
  const [state, setState] = useState<{ loading: boolean; entitled: boolean; error: string | null }>({ loading: true, entitled: false, error: null });
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void membershipStatus().then(result => {
        if (active) setState({ loading: false, entitled: result.entitled, error: null });
      }).catch(() => { if (active) setState({ loading: false, entitled: false, error: "Membership verification is temporarily unavailable." }); });
    };
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refresh());
    window.addEventListener("focus", refresh);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("focus", refresh); };
  }, []);
  if (state.loading) return <main role="status" className="min-h-screen grid place-items-center">Checking membership…</main>;
  if (!state.entitled) return <main className="min-h-screen flex items-center justify-center p-6">
    <section className="max-w-md w-full rounded-lg border border-border p-8 space-y-4 text-center">
      <h1 className="text-2xl font-bold">Vulture Vision membership</h1>
      <p>{state.error || "An active subscription is required to use the research workspace."}</p>
      <Button asChild><Link to="/account">Manage membership</Link></Button>
    </section>
  </main>;
  return <Outlet />;
}
