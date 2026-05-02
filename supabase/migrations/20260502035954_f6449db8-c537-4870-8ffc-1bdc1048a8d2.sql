CREATE TABLE public.tor_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'unknown',
  tags TEXT[] NOT NULL DEFAULT '{}',
  ping_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tor_entries_category ON public.tor_entries(category);
CREATE INDEX idx_tor_entries_status ON public.tor_entries(status);

ALTER TABLE public.tor_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tor entries are public" ON public.tor_entries FOR SELECT USING (true);
CREATE POLICY "Authed can insert tor entries" ON public.tor_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed can update tor entries" ON public.tor_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authed can delete tor entries" ON public.tor_entries FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tor_entries_updated_at
BEFORE UPDATE ON public.tor_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();