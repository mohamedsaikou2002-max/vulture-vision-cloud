-- Exposes worker health without revealing lease tokens or operational state.
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
 FROM public.news_context_queue q LEFT JOIN public.news_context_budget b ON b.window_start=date_trunc('hour',now()) WHERE q.id=1;
$$;
REVOKE ALL ON FUNCTION public.news_context_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.news_context_status() TO authenticated,service_role;
