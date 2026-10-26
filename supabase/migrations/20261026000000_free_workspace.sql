-- Explicit owner-requested removal of paid access. Historical billing records are retained.
-- Guests use Supabase anonymous Auth identities; existing own-user and operator RLS stays intact.
CREATE OR REPLACE FUNCTION public.vv_workspace_access(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_user_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id);
$$;
REVOKE ALL ON FUNCTION public.vv_workspace_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vv_workspace_access(uuid) TO service_role;
-- Retain historical policy/table names for compatibility, but they cannot impose payment.
UPDATE public.workspace_release_policy SET paid_access_required=false WHERE id=true;
