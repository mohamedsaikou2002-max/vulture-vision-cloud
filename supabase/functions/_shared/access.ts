import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const deny = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), { status, headers });

/** Verify identity and server-confirmed Stripe entitlement for customer functions. */
export async function memberIdentity(req: Request): Promise<{ userId: string } | Response> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || (service && token === service)) return deny("Sign in with a member account.", 401);
  if (!url || !anon || !service) return deny("Membership verification unavailable.", 503);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user || user.is_anonymous) return deny("Invalid member session.", 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: entitled, error: accessError } = await admin.rpc("vv_autosim_has_access", { p_user_id: user.id });
  if (accessError || typeof entitled !== "boolean") return deny("Membership verification unavailable.", 503);
  if (!entitled) return deny("An active membership is required.", 402);
  return { userId: user.id };
}

/** Operator functions keep their own allowlist; ordinary requests require a paid member. */
export async function authorize(req: Request, operatorOnly = false): Promise<Response | null> {
  if (!operatorOnly) {
    const identity = await memberIdentity(req);
    return identity instanceof Response ? identity : null;
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (service && token === service) return null;
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token) return deny("Operator sign-in required.", 401);
  if (!url || !anon) return deny("Operator verification unavailable.", 503);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user || user.is_anonymous) return deny("Invalid operator session.", 401);
  const allowed = (Deno.env.get("MIROFISH_ALLOWED_USER_IDS") || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!allowed.includes(user.id)) return deny("Operator access required.", 403);
  return null;
}
