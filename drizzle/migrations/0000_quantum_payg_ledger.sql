CREATE TABLE public.quantum_billing_config (
  id integer PRIMARY KEY DEFAULT 1,
  provider_rate_cents_per_qpu_sec integer NOT NULL DEFAULT 160,
  markup_bp integer NOT NULL DEFAULT 2500,
  est_qpu_secs_per_qubit_shot numeric NOT NULL DEFAULT 0.0004,
  quote_ttl_seconds integer NOT NULL DEFAULT 900,
  max_qubits integer NOT NULL DEFAULT 36,
  currency text NOT NULL DEFAULT 'usd',
  stripe_configured boolean NOT NULL DEFAULT false,
  ibm_configured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.quantum_billing_config TO authenticated;
GRANT ALL ON public.quantum_billing_config TO service_role;
ALTER TABLE public.quantum_billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read quantum billing config" ON public.quantum_billing_config FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quantum_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'quoted',
  n_qubits integer NOT NULL,
  shots integer NOT NULL,
  strategy_hash text,
  data_hash text,
  backend text,
  est_qpu_secs numeric NOT NULL,
  quote_cents integer NOT NULL,
  approved_cap_cents integer,
  quote_expires_at timestamptz,
  authorized_at timestamptz,
  provider_job_id text,
  provider_reported_qpu_secs numeric,
  provider_cost_cents integer,
  markup_cents integer,
  charge_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  rate_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_provider text,
  payment_intent_id text,
  payment_status text NOT NULL DEFAULT 'none',
  settlement_status text NOT NULL DEFAULT 'unsettled',
  adjustment_cents integer NOT NULL DEFAULT 0,
  refund_cents integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
GRANT SELECT ON public.quantum_jobs TO authenticated;
GRANT ALL ON public.quantum_jobs TO service_role;
ALTER TABLE public.quantum_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quantum jobs" ON public.quantum_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.quantum_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.quantum_jobs(id) ON DELETE RESTRICT,
  event text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quantum_job_events TO authenticated;
GRANT ALL ON public.quantum_job_events TO service_role;
ALTER TABLE public.quantum_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quantum job events" ON public.quantum_job_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.quantum_jobs j WHERE j.id = job_id AND j.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.quantum_jobs_no_update_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'quantum_job_events is append-only';
END;
$$;
CREATE TRIGGER quantum_job_events_immutable BEFORE UPDATE OR DELETE ON public.quantum_job_events FOR EACH ROW EXECUTE FUNCTION public.quantum_jobs_no_update_delete();

CREATE TRIGGER update_quantum_jobs_updated_at BEFORE UPDATE ON public.quantum_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.quantum_billing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;