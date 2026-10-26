-- Public workspace requested by owner; existing account research stays private.
CREATE TABLE public.public_workspace_jobs (LIKE public.autosim_jobs INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE public.public_workspace_jobs ADD CONSTRAINT public_jobs_parent_fk FOREIGN KEY(parent_job_id) REFERENCES public.public_workspace_jobs(id);
ALTER TABLE public.public_workspace_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.public_workspace_jobs TO anon,authenticated;
GRANT ALL ON public.public_workspace_jobs TO service_role;
CREATE POLICY "Public workspace history" ON public.public_workspace_jobs FOR SELECT TO anon,authenticated USING(true);
-- Public news/context metadata: read-only browser access with the publishable key.
GRANT SELECT ON public.news_articles,public.news_source_status,public.news_prompt_versions TO anon;
CREATE POLICY "Public news metadata" ON public.news_articles FOR SELECT TO anon USING(true);
CREATE POLICY "Public source health" ON public.news_source_status FOR SELECT TO anon USING(true);
CREATE POLICY "Public news context" ON public.news_prompt_versions FOR SELECT TO anon USING(true);
CREATE FUNCTION public.vv_claim_public_autosim(p_user_id uuid, p_job_id uuid, p_scenario text, p_parent_id uuid, p_limit integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT user_id INTO existing_user FROM public.public_workspace_jobs WHERE id = p_job_id;
  IF FOUND THEN RETURN CASE WHEN existing_user = p_user_id THEN 'existing' ELSE 'forbidden' END; END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.public_workspace_jobs WHERE id = p_parent_id AND user_id = p_user_id AND status = 'completed') THEN RETURN 'invalid_parent'; END IF;
  INSERT INTO public.public_workspace_jobs(id,user_id,parent_job_id,scenario) VALUES(p_job_id,p_user_id,p_parent_id,p_scenario);
  RETURN 'claimed';
END;
$$;
REVOKE ALL ON FUNCTION public.vv_claim_public_autosim(uuid,uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vv_claim_public_autosim(uuid,uuid,text,uuid,integer) TO service_role;
