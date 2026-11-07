-- Re-enable paid, authenticated Vulture Vision workspace after the 2026-10 public release.
-- Canonical forward-only migration. Do not delete public or historical private records.
-- Checkout remains disabled at the Edge until real Stripe test-mode validation succeeds.
-- Existing public history remains stored but becomes inaccessible without ownership.
CREATE OR REPLACE FUNCTION public.vv_workspace_access(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p_user_id IS NOT NULL AND public.vv_autosim_has_access(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.vv_workspace_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vv_workspace_access(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.vv_current_member_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND public.vv_workspace_access((SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.vv_current_member_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vv_current_member_access() TO authenticated;

-- Remove intentionally public read permissions from the earlier free-workspace release.
REVOKE SELECT ON public.public_workspace_jobs, public.news_articles,
  public.news_source_status, public.news_prompt_versions, public.tor_entries
  FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Public workspace history" ON public.public_workspace_jobs;
DROP POLICY IF EXISTS "Paid owner history" ON public.public_workspace_jobs;
CREATE POLICY "Paid owner history" ON public.public_workspace_jobs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.vv_current_member_access()));
GRANT SELECT ON public.public_workspace_jobs TO authenticated;

DROP POLICY IF EXISTS "Public news metadata" ON public.news_articles;
DROP POLICY IF EXISTS "Public source health" ON public.news_source_status;
DROP POLICY IF EXISTS "Public news context" ON public.news_prompt_versions;
DROP POLICY IF EXISTS "Tor entries are public" ON public.tor_entries;
DROP POLICY IF EXISTS "Paid news metadata" ON public.news_articles;
DROP POLICY IF EXISTS "Paid source metadata" ON public.news_source_status;
DROP POLICY IF EXISTS "Paid news context" ON public.news_prompt_versions;
DROP POLICY IF EXISTS "Paid tor metadata" ON public.tor_entries;

CREATE POLICY "Paid news metadata" ON public.news_articles FOR SELECT TO authenticated
  USING ((SELECT public.vv_current_member_access()));
CREATE POLICY "Paid source metadata" ON public.news_source_status FOR SELECT TO authenticated
  USING ((SELECT public.vv_current_member_access()));
CREATE POLICY "Paid news context" ON public.news_prompt_versions FOR SELECT TO authenticated
  USING ((SELECT public.vv_current_member_access()));
CREATE POLICY "Paid tor metadata" ON public.tor_entries FOR SELECT TO authenticated
  USING ((SELECT public.vv_current_member_access()));
GRANT SELECT ON public.news_articles, public.news_source_status, public.news_prompt_versions,
  public.tor_entries TO authenticated;

-- Public tor data was once editable by any signed-in identity. Remove that bypass.
DROP POLICY IF EXISTS "Authed can insert tor entries" ON public.tor_entries;
DROP POLICY IF EXISTS "Authed can update tor entries" ON public.tor_entries;
DROP POLICY IF EXISTS "Authed can delete tor entries" ON public.tor_entries;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tor_entries FROM authenticated;

-- Reaffirm the original subscription guards, independently of the old free-access flag.
UPDATE public.workspace_release_policy SET paid_access_required = true WHERE id = true;

-- Deliberately preserve historical billing customers, webhook receipts and private jobs.
-- Public visitor sign-in is supported, but premium data/Edge functions require paid access.
