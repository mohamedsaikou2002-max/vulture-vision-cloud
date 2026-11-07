import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Authentication only. Entitlement is separately checked by MembershipGate and the API. */
export default function AuthGate() {
  const location = useLocation();
  const [state, setState] = useState<{ ready: boolean; user: User | null }>({ ready: false, user: null });
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) setState({ ready: true, user: error ? null : data.user });
    }).catch(() => { if (active) setState({ ready: true, user: null }); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) setState({ ready: true, user: null });
      else setState({ ready: true, user: session.user });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (!state.ready) return <main role="status" className="min-h-screen grid place-items-center">Checking sign-in…</main>;
  if (!state.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
