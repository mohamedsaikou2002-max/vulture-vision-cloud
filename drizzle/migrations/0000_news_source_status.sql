-- Collector heartbeat is server-written; publishers with access/DNS failures stay visible.
CREATE TABLE IF NOT EXISTS public.news_source_status (
  source_id text PRIMARY KEY,
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('reachable','no_articles','skipped')),
  articles integer NOT NULL DEFAULT 0 CHECK (articles >= 0),
  checked_at timestamptz NOT NULL,
  error_kind text
);
ALTER TABLE public.news_source_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_source_status FROM anon, authenticated;
GRANT SELECT ON public.news_source_status TO authenticated;
GRANT ALL ON public.news_source_status TO service_role;
CREATE POLICY "Members read source heartbeat" ON public.news_source_status FOR SELECT TO authenticated USING (true);
