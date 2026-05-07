
CREATE TABLE public.trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  side text NOT NULL,
  qty numeric NOT NULL,
  price numeric NOT NULL,
  pnl numeric,
  mode text NOT NULL DEFAULT 'paper',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trade_history_created ON public.trade_history(created_at DESC);
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trade history public" ON public.trade_history FOR SELECT USING (true);
CREATE POLICY "Authed insert trade" ON public.trade_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update trade" ON public.trade_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authed delete trade" ON public.trade_history FOR DELETE TO authenticated USING (true);

CREATE TABLE public.synthesis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis jsonb,
  antithesis jsonb,
  synthesis jsonb,
  narrative text,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_synthesis_created ON public.synthesis_history(created_at DESC);
ALTER TABLE public.synthesis_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Synthesis public" ON public.synthesis_history FOR SELECT USING (true);
CREATE POLICY "Authed insert synth" ON public.synthesis_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update synth" ON public.synthesis_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authed delete synth" ON public.synthesis_history FOR DELETE TO authenticated USING (true);

CREATE TABLE public.kill_switch_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'warning',
  reason text NOT NULL,
  source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kill_switch_created ON public.kill_switch_alerts(created_at DESC);
ALTER TABLE public.kill_switch_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kill switch public" ON public.kill_switch_alerts FOR SELECT USING (true);
CREATE POLICY "Authed insert ks" ON public.kill_switch_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update ks" ON public.kill_switch_alerts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authed delete ks" ON public.kill_switch_alerts FOR DELETE TO authenticated USING (true);
