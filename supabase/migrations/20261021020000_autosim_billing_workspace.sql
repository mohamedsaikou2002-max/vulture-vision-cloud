-- Vulture Vision canonical Supabase migration: AutoSim -> Stripe billing -> workspace security.
-- This migration MUST be applied after 20261020040000_news_source_status.sql
-- and 20261021010000_headline_translation.sql (Supabase migrations run in name order).
-- DO NOT execute the historical drizzle/migrations/*.sql as a separate second migration stream.
-- Pre-existing objects require a schema reconciliation before applying; never force by dropping paid records.
-- Release policy remains paid_access_required = false until staging payment/entitlement tests pass.

-- PART 1 / 3: AutoSim base and subscriptions
-- Additive only: preserve existing billing, operator access and user data.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'inactive',
  plan text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autosim_read_own_subscription" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.vv_autosim_has_access(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id
    AND status IN ('active','trialing') AND current_period_end > now());
$$;
REVOKE ALL ON FUNCTION public.vv_autosim_has_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vv_autosim_has_access(uuid) TO service_role;

CREATE TABLE public.autosim_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  parent_job_id uuid REFERENCES public.autosim_jobs(id),
  scenario text NOT NULL CHECK (length(scenario) BETWEEN 8 AND 2000),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','interpreting','retrieving_evidence','estimating_state','simulating','analyzing','completed','failed','cancelled')),
  stage_log jsonb NOT NULL DEFAULT '[]'::jsonb, result jsonb, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
GRANT SELECT ON public.autosim_jobs TO authenticated;
GRANT ALL ON public.autosim_jobs TO service_role;
ALTER TABLE public.autosim_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own autosim jobs" ON public.autosim_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX autosim_jobs_user_time ON public.autosim_jobs(user_id, created_at DESC);

-- Serialize claims per user; an existing ID cannot trigger a second provider run.
CREATE FUNCTION public.vv_claim_autosim(p_user_id uuid, p_job_id uuid, p_scenario text, p_parent_id uuid, p_limit integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_user uuid;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Invalid daily limit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT user_id INTO existing_user FROM public.autosim_jobs WHERE id = p_job_id;
  IF FOUND THEN RETURN CASE WHEN existing_user = p_user_id THEN 'existing' ELSE 'forbidden' END; END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.autosim_jobs WHERE id = p_parent_id AND user_id = p_user_id AND status = 'completed') THEN RETURN 'invalid_parent'; END IF;
  IF (SELECT count(*) FROM public.autosim_jobs WHERE user_id = p_user_id AND created_at >= now() - interval '24 hours') >= p_limit THEN RETURN 'quota_exceeded'; END IF;
  INSERT INTO public.autosim_jobs(id,user_id,parent_job_id,scenario) VALUES(p_job_id,p_user_id,p_parent_id,p_scenario);
  RETURN 'claimed';
END;
$$;
REVOKE ALL ON FUNCTION public.vv_claim_autosim(uuid,uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vv_claim_autosim(uuid,uuid,text,uuid,integer) TO service_role;

-- PART 2 / 3: Stripe billing
-- Staged billing integration. Apply only to the configured project through its release process.
CREATE TABLE public.billing_customers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 stripe_customer_id text UNIQUE NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.billing_checkout_attempts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE public.billing_webhook_events (
 event_id text PRIMARY KEY, user_id uuid NOT NULL, stripe_created bigint NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_id_unique ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_customers,public.billing_checkout_attempts,public.billing_webhook_events FROM anon,authenticated;
GRANT ALL ON public.billing_customers,public.billing_checkout_attempts,public.billing_webhook_events TO service_role;
CREATE FUNCTION public.vv_claim_checkout(p_user_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.billing_checkout_attempts;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=p_user_id AND status IN ('active','trialing','past_due','unpaid','incomplete')) THEN RETURN NULL; END IF;
 SELECT * INTO row FROM public.billing_checkout_attempts WHERE user_id=p_user_id;
 IF FOUND AND row.expires_at>now() THEN RETURN to_jsonb(row); END IF;
 INSERT INTO public.billing_checkout_attempts(user_id,request_id,expires_at) VALUES(p_user_id,p_request_id,date_trunc('second',now())+interval '1 hour')
 ON CONFLICT(user_id) DO UPDATE SET request_id=excluded.request_id,expires_at=excluded.expires_at RETURNING * INTO row;
 RETURN to_jsonb(row);
END;$$;
CREATE FUNCTION public.vv_apply_billing_event(p_event_id text,p_created bigint,p_user_id uuid,p_snapshot jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted integer; existing public.subscriptions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.billing_customers WHERE user_id=p_user_id AND stripe_customer_id=p_snapshot->>'customer') THEN RAISE EXCEPTION 'Invalid customer binding'; END IF;
 INSERT INTO public.billing_webhook_events(event_id,user_id,stripe_created) VALUES(p_event_id,p_user_id,p_created) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=0 THEN RETURN 'duplicate'; END IF;
 SELECT * INTO existing FROM public.subscriptions WHERE user_id=p_user_id;
 IF FOUND AND existing.stripe_subscription_id IS DISTINCT FROM p_snapshot->>'subscription' AND existing.status IN ('active','trialing') AND p_snapshot->>'status' NOT IN ('active','trialing') THEN RETURN 'stale'; END IF;
 IF FOUND AND (existing.stripe_event_created>p_created OR (existing.stripe_event_created=p_created AND existing.stripe_subscription_id=p_snapshot->>'subscription' AND existing.status IN ('canceled','unpaid') AND p_snapshot->>'status' IN ('active','trialing'))) THEN RETURN 'stale'; END IF;
 INSERT INTO public.subscriptions(user_id,status,plan,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_end,trial_end,cancel_at_period_end,stripe_event_created)
 VALUES(p_user_id,p_snapshot->>'status','membership',p_snapshot->>'customer',p_snapshot->>'subscription',p_snapshot->>'price',(p_snapshot->>'period_end')::timestamptz,(p_snapshot->>'trial_end')::timestamptz,(p_snapshot->>'cancel_at_period_end')::boolean,p_created)
 ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,plan=excluded.plan,stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,stripe_price_id=excluded.stripe_price_id,current_period_end=excluded.current_period_end,trial_end=excluded.trial_end,cancel_at_period_end=excluded.cancel_at_period_end,stripe_event_created=excluded.stripe_event_created,updated_at=now();
 RETURN 'applied';
END;$$;
REVOKE ALL ON FUNCTION public.vv_claim_checkout(uuid,uuid),public.vv_apply_billing_event(text,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vv_claim_checkout(uuid,uuid),public.vv_apply_billing_event(text,bigint,uuid,jsonb) TO service_role;


-- PART 3 / 3: Workspace enforcement (staged)
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

