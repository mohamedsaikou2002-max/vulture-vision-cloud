import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasActivePaidSubscription, type EntitlementRecord } from "./subscription_policy.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const denied = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers });

/** Server-side check. Never trust client state or a checkout success URL. */
export async function paidAccessForUser(userId: string): Promise<Response | null> {
  const mode = Deno.env.get("VV_BILLING_ENV");
  if (mode !== "test" && mode !== "live") return denied("billing_environment_unconfigured", 503);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return denied("billing_service_unconfigured", 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: settings, error: settingError } = await db.from("vv_billing_environment")
    .select("mode").eq("id", true).maybeSingle();
  if (settingError || settings?.mode !== mode) return denied("billing_environment_mismatch", 503);
  const { data, error } = await db.from("vv_billing_subscriptions")
    .select("mode,stripe_status,last_invoice_status,paid_until")
    .eq("user_id", userId).eq("mode", mode)
    .eq("stripe_status", "active").eq("last_invoice_status", "paid")
    .gt("paid_until", new Date().toISOString()).limit(1);
  if (error) return denied("billing_access_unavailable", 503);
  if (!data?.some((row: EntitlementRecord) => hasActivePaidSubscription(row, mode)))
    return denied("subscription_required", 402);
  return null;
}

/** For functions without an existing auth helper. Requires a real Supabase JWT. */
export async function requirePaid(req: Request): Promise<Response | null> {
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return denied("sign_in_required", 401);
  // Only server-side workers holding the service key can bypass paid-user checks.
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (service && bearer === service) return null;
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return denied("auth_service_unavailable", 503);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(bearer);
  if (error || !user) return denied("sign_in_required", 401);
  return paidAccessForUser(user.id);
}
