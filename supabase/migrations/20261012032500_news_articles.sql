-- Crawler writes use a server credential; authenticated clients can only read.
CREATE TABLE IF NOT EXISTS public.news_articles (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 600),
  source text NOT NULL,
  canonical_url text NOT NULL UNIQUE CHECK (canonical_url ~ '^https?://'),
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_country text NOT NULL CHECK (source_country ~ '^[A-Z]{2}$'),
  language text,
  source_id text NOT NULL,
  ingestion_method text NOT NULL
);
CREATE INDEX IF NOT EXISTS news_articles_country_time ON public.news_articles(source_country, published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_fetched_at ON public.news_articles(fetched_at DESC);
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_articles FROM anon, authenticated;
GRANT SELECT ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;
CREATE POLICY "Signed in read publisher news" ON public.news_articles FOR SELECT TO authenticated USING (true);
