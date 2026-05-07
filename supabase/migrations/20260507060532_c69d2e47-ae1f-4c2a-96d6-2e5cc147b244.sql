CREATE TABLE public.warm_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_warm_state_key ON public.warm_state(key);
CREATE INDEX idx_warm_state_expires ON public.warm_state(expires_at);

ALTER TABLE public.warm_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warm state is public" ON public.warm_state FOR SELECT USING (true);
CREATE POLICY "Authed insert warm state" ON public.warm_state FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update warm state" ON public.warm_state FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authed delete warm state" ON public.warm_state FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_warm_state_updated_at
BEFORE UPDATE ON public.warm_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();