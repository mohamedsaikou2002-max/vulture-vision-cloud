CREATE TABLE public.scenario_synthesis_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, window_start)
);
ALTER TABLE public.scenario_synthesis_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scenario_synthesis_limits FROM anon, authenticated;
GRANT ALL ON public.scenario_synthesis_limits TO service_role;
CREATE OR REPLACE FUNCTION public.claim_scenario_synthesis(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.scenario_synthesis_limits(user_id,window_start,requests)
  VALUES(p_user_id,date_trunc('hour',now()),1)
  ON CONFLICT(user_id,window_start) DO UPDATE
  SET requests=scenario_synthesis_limits.requests+1
  WHERE scenario_synthesis_limits.requests < 6
  RETURNING requests INTO n;
  RETURN n IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_scenario_synthesis(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scenario_synthesis(uuid) TO service_role;
