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