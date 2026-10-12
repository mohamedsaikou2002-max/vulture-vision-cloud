CREATE TABLE public.news_prompt_versions (
  version bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_revision bigint NOT NULL UNIQUE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  context jsonb NOT NULL
);
ALTER TABLE public.news_prompt_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_prompt_versions FROM anon, authenticated;
GRANT SELECT ON public.news_prompt_versions TO authenticated;
GRANT ALL ON public.news_prompt_versions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.news_prompt_versions_version_seq TO service_role;
CREATE POLICY "Signed in read simulation context" ON public.news_prompt_versions FOR SELECT TO authenticated USING (true);
CREATE TABLE public.news_context_queue (
  id integer PRIMARY KEY CHECK(id=1), revision bigint NOT NULL DEFAULT 1,
  processed_revision bigint NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
  last_attempt timestamptz, last_error text
);
INSERT INTO public.news_context_queue(id) VALUES(1);
ALTER TABLE public.news_context_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_context_queue FROM anon, authenticated;
GRANT ALL ON public.news_context_queue TO service_role;
CREATE TABLE public.news_context_budget (
  window_start timestamptz PRIMARY KEY, attempts integer NOT NULL
);
ALTER TABLE public.news_context_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_context_budget FROM anon, authenticated;
GRANT ALL ON public.news_context_budget TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_news_context() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.title,NEW.published_at,NEW.source_country,NEW.language,NEW.canonical_url,NEW.source)
    IS NOT DISTINCT FROM ROW(OLD.title,OLD.published_at,OLD.source_country,OLD.language,OLD.canonical_url,OLD.source) THEN RETURN NEW; END IF;
  UPDATE public.news_context_queue SET revision=revision+1 WHERE id=1;
  RETURN NULL;
END;
$$;
CREATE TRIGGER news_context_changed AFTER INSERT OR UPDATE OR DELETE ON public.news_articles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_news_context();
CREATE OR REPLACE FUNCTION public.claim_news_context()
RETURNS TABLE(source_revision bigint, token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.news_context_queue%ROWTYPE; n integer; refresh_needed boolean;
BEGIN
  SELECT * INTO q FROM public.news_context_queue WHERE id=1 FOR UPDATE;
  IF q.lease_until > now() OR q.last_attempt > now()-interval '30 seconds' THEN RETURN; END IF;
  SELECT NOT EXISTS(SELECT 1 FROM public.news_prompt_versions WHERE expires_at > now()) INTO refresh_needed;
  IF q.revision <= q.processed_revision AND NOT refresh_needed THEN RETURN; END IF;
  INSERT INTO public.news_context_budget(window_start,attempts) VALUES(date_trunc('hour',now()),1)
  ON CONFLICT(window_start) DO UPDATE SET attempts=news_context_budget.attempts+1
  WHERE news_context_budget.attempts < 60 RETURNING attempts INTO n;
  IF n IS NULL THEN RETURN; END IF;
  UPDATE public.news_context_queue SET revision=CASE WHEN revision<=processed_revision THEN revision+1 ELSE revision END,
    lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',last_attempt=now(),last_error=NULL
  WHERE id=1 RETURNING revision,lease_token INTO source_revision,token;
  RETURN NEXT;
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_news_context(p_token uuid,p_revision bigint,p_context jsonb,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.news_context_queue WHERE id=1 AND lease_token=p_token AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_context IS NOT NULL THEN
    INSERT INTO public.news_prompt_versions(source_revision,expires_at,context)
    VALUES(p_revision,(p_context->>'expires_at')::timestamptz,p_context);
    UPDATE public.news_context_queue SET processed_revision=p_revision WHERE id=1;
  END IF;
  UPDATE public.news_context_queue SET lease_token=NULL,lease_until=NULL,last_error=p_error WHERE id=1;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_news_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_news_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_news_context(uuid,bigint,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_news_context() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_news_context(uuid,bigint,jsonb,text) TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS(
 SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='news_prompt_versions') THEN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.news_prompt_versions;
 END IF;
END $$;
