-- Repair missing live schema without replaying old migrations or resetting translations.
-- Original headline remains immutable to translation workers; translations are separate metadata.
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS original_title text;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS translated_title_en text;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS translation_source_language text;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS translated_at timestamptz;
CREATE TABLE IF NOT EXISTS public.headline_translation_cache (
 content_hash text PRIMARY KEY, original_title text NOT NULL, source_language text,
 translated_title_en text NOT NULL, provider text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.headline_translation_queue (
 article_id text PRIMARY KEY REFERENCES public.news_articles(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, error_code text
);
CREATE INDEX IF NOT EXISTS headline_translation_ready ON public.headline_translation_queue(available_at,leased_until);
ALTER TABLE public.headline_translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headline_translation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.headline_translation_cache,public.headline_translation_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.headline_translation_cache,public.headline_translation_queue TO service_role;
CREATE OR REPLACE FUNCTION public.vv_enqueue_translation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.title IS DISTINCT FROM OLD.title OR NEW.language IS DISTINCT FROM OLD.language THEN
 INSERT INTO public.headline_translation_queue(article_id) VALUES(NEW.id)
 ON CONFLICT(article_id) DO UPDATE SET attempts=0,available_at=now(),lease_token=NULL,leased_until=NULL,error_code=NULL;
 END IF; RETURN NEW;
END;$$;
-- Avoid inserting an FK before the article exists.
CREATE OR REPLACE FUNCTION public.vv_queue_translation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.original_title=NEW.title;
 IF TG_OP='UPDATE' AND NEW.title=OLD.title AND NEW.language IS NOT DISTINCT FROM OLD.language THEN RETURN NEW; END IF;
 NEW.translated_title_en=NULL;NEW.translated_at=NULL;NEW.translation_status='pending';RETURN NEW;
END;$$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.news_articles'::regclass AND tgname='headline_original') THEN CREATE TRIGGER headline_original BEFORE INSERT OR UPDATE OF title,language ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.vv_queue_translation(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.news_articles'::regclass AND tgname='headline_enqueue') THEN CREATE TRIGGER headline_enqueue AFTER INSERT OR UPDATE OF title,language ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.vv_enqueue_translation(); END IF; END $$;
UPDATE public.news_articles SET original_title=title WHERE original_title IS NULL;
UPDATE public.news_articles SET translation_status='original_english' WHERE (language='en' OR language LIKE 'en-%') AND translated_title_en IS NULL;
INSERT INTO public.headline_translation_queue(article_id) SELECT id FROM public.news_articles WHERE translation_status NOT IN ('translated','original_english') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.vv_claim_translations() RETURNS TABLE(article_id text,lease_token uuid,title text,language text,source_id text,attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH ready AS (SELECT q.article_id FROM public.headline_translation_queue q JOIN public.news_articles n ON n.id=q.article_id
 WHERE q.available_at<=now() AND (q.leased_until IS NULL OR q.leased_until<now()) AND q.attempts<5
 AND n.fetched_at>now()-interval '48 hours' ORDER BY q.available_at FOR UPDATE OF q SKIP LOCKED LIMIT 20),
 claimed AS (UPDATE public.headline_translation_queue q SET lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes',attempts=q.attempts+1 FROM ready r WHERE q.article_id=r.article_id RETURNING q.*)
 SELECT c.article_id,c.lease_token,n.title,n.language,n.source_id,c.attempts FROM claimed c JOIN public.news_articles n ON n.id=c.article_id;
$$;
CREATE OR REPLACE FUNCTION public.vv_finish_translation(p_article_id text,p_token uuid,p_title text,p_english text,p_language text,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.headline_translation_queue;
BEGIN
 SELECT * INTO q FROM public.headline_translation_queue WHERE article_id=p_article_id AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.news_articles WHERE id=p_article_id AND title=p_title) THEN RETURN false; END IF;
 IF p_error IS NULL THEN
 UPDATE public.news_articles SET translated_title_en=p_english,translation_source_language=p_language,translation_status=CASE WHEN p_english IS NULL THEN 'original_english' ELSE 'translated' END,translated_at=now() WHERE id=p_article_id;
 DELETE FROM public.headline_translation_queue WHERE article_id=p_article_id;
 ELSE
 UPDATE public.news_articles SET translation_status=CASE WHEN p_error='rights_not_approved' THEN 'rights_not_approved' WHEN q.attempts>=5 THEN 'failed' ELSE 'retrying' END WHERE id=p_article_id;
 UPDATE public.headline_translation_queue SET lease_token=NULL,leased_until=NULL,error_code=p_error,available_at=now()+make_interval(secs=>least(3600,30*power(2,q.attempts)::integer)),attempts=CASE WHEN p_error='rights_not_approved' THEN 5 ELSE attempts END WHERE article_id=p_article_id;
 END IF; RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.vv_queue_translation(),public.vv_enqueue_translation(),public.vv_claim_translations(),public.vv_finish_translation(text,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vv_claim_translations(),public.vv_finish_translation(text,uuid,text,text,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.public_workspace_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  parent_job_id uuid REFERENCES public.public_workspace_jobs(id),
  scenario text NOT NULL CHECK (length(scenario) BETWEEN 8 AND 2000),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','interpreting','retrieving_evidence','estimating_state','simulating','analyzing','completed','failed','cancelled')),
  stage_log jsonb NOT NULL DEFAULT '[]'::jsonb, result jsonb, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE public.public_workspace_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.public_workspace_jobs TO anon,authenticated;
GRANT ALL ON public.public_workspace_jobs TO service_role;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.public_workspace_jobs'::regclass AND polname='Public workspace history') THEN CREATE POLICY "Public workspace history" ON public.public_workspace_jobs FOR SELECT TO anon,authenticated USING(true); END IF; END $$;
GRANT SELECT ON public.news_articles TO anon;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.news_articles'::regclass AND polname='Public news metadata') THEN CREATE POLICY "Public news metadata" ON public.news_articles FOR SELECT TO anon USING(true); END IF; END $$;
CREATE OR REPLACE FUNCTION public.vv_claim_public_autosim(p_user_id uuid, p_job_id uuid, p_scenario text, p_parent_id uuid, p_limit integer)
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

NOTIFY pgrst, 'reload schema';
