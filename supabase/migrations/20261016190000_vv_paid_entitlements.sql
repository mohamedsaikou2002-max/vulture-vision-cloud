-- Vulture Vision: Stripe-owned subscriptions and fail-closed paid access.
-- In beta use mode=test; in production use mode=live. Never mix test entitlements with live.
CREATE TABLE IF NOT EXISTS public.vv_billing_environment (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode text NOT NULL DEFAULT 'unconfigured' CHECK (mode IN ('unconfigured','test','live')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.vv_billing_environment(id,mode)
  VALUES (true,'unconfigured') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vv_billing_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vv_billing_subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  price_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  stripe_status text NOT NULL,
  last_invoice_status text NOT NULL DEFAULT 'unknown',
  paid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vv_billing_subscriptions_user_idx
  ON public.vv_billing_subscriptions(user_id,mode,paid_until DESC);
CREATE TABLE IF NOT EXISTS public.vv_stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','processed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
DO $$ DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['vv_billing_environment','vv_billing_customers','vv_billing_subscriptions','vv_stripe_webhook_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated', name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', name);
  END LOOP;
END $$;
-- Signed-in users can ask only whether THEIR OWN subscription is paid.
CREATE OR REPLACE FUNCTION public.vv_has_paid_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.vv_billing_subscriptions s
    JOIN public.vv_billing_environment e ON e.id=true
    WHERE s.user_id=(SELECT auth.uid())
      AND e.mode IN ('test','live')
      AND s.mode=e.mode
      AND s.stripe_status='active'
      AND s.last_invoice_status='paid'
      AND s.paid_until > now()
  );
$$;
REVOKE ALL ON FUNCTION public.vv_has_paid_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vv_has_paid_access() TO authenticated,service_role;
-- Block direct REST/Realtime reads that would otherwise bypass the React paywall.
DO $$ DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['news_articles','news_prompt_versions','tor_entries'] LOOP
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename=t AND cmd='SELECT' LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.vv_has_paid_access())',
      'Paid subscriber read '||t,t);
  END LOOP;
END $$;
-- News-context status is metadata about a paid research service: hide it from unpaid callers.
CREATE OR REPLACE FUNCTION public.news_context_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'status',CASE WHEN q.lease_until>now() THEN 'updating'
    WHEN coalesce(b.attempts,0)>=60 THEN 'budget_exhausted'
    WHEN q.last_error IS NOT NULL THEN 'retrying'
    WHEN q.last_attempt>now()-interval '60 seconds' THEN 'throttled'
    WHEN q.revision>q.processed_revision OR NOT EXISTS(SELECT 1 FROM public.news_prompt_versions WHERE expires_at>now()) THEN 'waiting'
    ELSE 'current' END,
    'last_attempt',q.last_attempt,'last_error',q.last_error,
    'pending',q.revision>q.processed_revision,'attempts_this_hour',coalesce(b.attempts,0),
    'next_budget_reset',date_trunc('hour',now())+interval '1 hour')
  FROM public.news_context_queue q
  LEFT JOIN public.news_context_budget b ON b.window_start=date_trunc('hour',now())
  WHERE q.id=1 AND ((select auth.role())='service_role' OR public.vv_has_paid_access());
$$;
REVOKE ALL ON FUNCTION public.news_context_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.news_context_status() TO authenticated,service_role;
-- Critical: after applying migration, set mode explicitly with operator-only SQL:
-- UPDATE public.vv_billing_environment SET mode='test' WHERE id=true;  -- beta
-- UPDATE public.vv_billing_environment SET mode='live' WHERE id=true;  -- commercial
-- Use SEPARATE Supabase projects for beta and commercial. Never have both deploy against one DB.
