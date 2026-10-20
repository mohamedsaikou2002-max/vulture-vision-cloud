-- STAGED: enforcing paid access requires explicit release acceptance after Stripe staging tests.
CREATE TABLE public.workspace_release_policy (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), paid_access_required boolean NOT NULL DEFAULT false
);
INSERT INTO public.workspace_release_policy(id) VALUES(true);
ALTER TABLE public.workspace_release_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_release_policy FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.workspace_release_policy TO service_role;
-- Only server-written, Stripe-confirmed subscriptions qualify. No editable profile metadata.
CREATE OR REPLACE FUNCTION public.vv_autosim_has_access(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.billing_customers c
 ON c.user_id=s.user_id AND c.stripe_customer_id=s.stripe_customer_id
 WHERE s.user_id=p_user_id AND s.status IN ('active','trialing') AND s.current_period_end>now()
 AND s.stripe_subscription_id IS NOT NULL AND s.stripe_price_id IS NOT NULL AND s.stripe_event_created>0);
$$;
CREATE FUNCTION public.vv_workspace_access(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspace_release_policy WHERE id=true AND
 (NOT paid_access_required OR public.vv_autosim_has_access(p_user_id)));
$$;
REVOKE ALL ON FUNCTION public.vv_workspace_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vv_workspace_access(uuid) TO service_role;
-- RLS helper cannot be used to inspect another account.
CREATE FUNCTION public.vv_current_member_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND public.vv_workspace_access(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.vv_current_member_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vv_current_member_access() TO authenticated;
DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['news_articles','tor_entries','news_prompt_versions','news_source_status','autosim_jobs'] LOOP
  EXECUTE format('CREATE POLICY "Paid workspace restriction" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.vv_current_member_access()))',t);
 END LOOP;
END $$;
