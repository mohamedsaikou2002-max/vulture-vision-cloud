-- Point-in-time corpus and immutable forecast log.
-- Ingestion/scoring must run server-side with the Supabase service role.
-- Client roles cannot write raw corpus data or fabricate forecasts/scores.

CREATE TABLE public.forecast_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  horizon_sessions integer NOT NULL CHECK (horizon_sessions > 0),
  outcome_type text NOT NULL CHECK (outcome_type IN ('binary', 'continuous')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_key, version)
);

CREATE TABLE public.forecast_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_name text NOT NULL,
  license_name text,
  terms_url text,
  attribution_text text,
  supports_point_in_time boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per published/observed value. available_at is when the value
-- could first have been known; vintage_at preserves subsequent revisions.
CREATE TABLE public.corpus_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.forecast_sources(id),
  series_key text NOT NULL,
  instrument text,
  observation_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL,
  vintage_at timestamptz,
  numeric_value double precision,
  text_value text,
  unit text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CHECK (numeric_value IS NOT NULL OR text_value IS NOT NULL)
);

CREATE INDEX idx_corpus_observations_asof
  ON public.corpus_observations (series_key, available_at DESC);
CREATE INDEX idx_corpus_observations_instrument_asof
  ON public.corpus_observations (instrument, series_key, available_at DESC);
CREATE INDEX idx_corpus_observations_vintage
  ON public.corpus_observations (vintage_at DESC)
  WHERE vintage_at IS NOT NULL;

-- A reproducible feature vector assembled only from observations available
-- at as_of. provenance records source IDs, release cutoffs and transforms.
CREATE TABLE public.corpus_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  as_of timestamptz NOT NULL,
  regime text,
  feature_schema_version text NOT NULL,
  features jsonb NOT NULL CHECK (jsonb_typeof(features) = 'object'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument, as_of, feature_schema_version)
);

CREATE INDEX idx_corpus_snapshots_asof
  ON public.corpus_snapshots (instrument, as_of DESC);

-- Labels are attached only after the entire target horizon has matured.
CREATE TABLE public.corpus_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.corpus_snapshots(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.forecast_targets(id),
  realized_event boolean,
  realized_value double precision,
  outcome_available_at timestamptz NOT NULL,
  label_version integer NOT NULL DEFAULT 1 CHECK (label_version > 0),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (realized_event IS NOT NULL OR realized_value IS NOT NULL),
  UNIQUE (snapshot_id, target_id, label_version)
);

CREATE INDEX idx_corpus_outcomes_target_available
  ON public.corpus_outcomes (target_id, outcome_available_at DESC);

-- Forecasts are append-only through the client API. Store the exact cutoff,
-- inputs, model/data versions, raw and calibrated probabilities, and output.
CREATE TABLE public.forecast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.forecast_targets(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  as_of timestamptz NOT NULL,
  scenario jsonb NOT NULL CHECK (jsonb_typeof(scenario) = 'object'),
  feature_snapshot jsonb NOT NULL CHECK (jsonb_typeof(feature_snapshot) = 'object'),
  model_version text NOT NULL,
  calibration_version text,
  corpus_version text NOT NULL,
  ensemble_size integer NOT NULL CHECK (ensemble_size > 0),
  seed_manifest jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(seed_manifest) = 'array'),
  raw_probability double precision
    CHECK (raw_probability IS NULL OR raw_probability BETWEEN 0 AND 1),
  calibrated_probability double precision
    CHECK (calibrated_probability IS NULL OR calibrated_probability BETWEEN 0 AND 1),
  predictive_summary jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(predictive_summary) = 'object'),
  status text NOT NULL DEFAULT 'complete'
    CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_runs_owner_issued
  ON public.forecast_runs (owner_id, issued_at DESC);
CREATE INDEX idx_forecast_runs_target_issued
  ON public.forecast_runs (target_id, issued_at DESC);

-- Individual stochastic draws are retained for audit/reaggregation. They
-- are not independent historical examples for model training.
CREATE TABLE public.forecast_run_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id uuid NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
  draw_index integer NOT NULL CHECK (draw_index >= 0),
  seed bigint NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_run_id, draw_index),
  UNIQUE (forecast_run_id, seed)
);

CREATE TABLE public.forecast_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id uuid NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
  realized_event boolean,
  realized_value double precision,
  brier_score double precision CHECK (brier_score IS NULL OR brier_score BETWEEN 0 AND 1),
  log_loss double precision CHECK (log_loss IS NULL OR log_loss >= 0),
  crps double precision CHECK (crps IS NULL OR crps >= 0),
  outcome_available_at timestamptz NOT NULL,
  scoring_version text NOT NULL,
  scored_at timestamptz NOT NULL DEFAULT now(),
  CHECK (realized_event IS NOT NULL OR realized_value IS NOT NULL),
  UNIQUE (forecast_run_id, scoring_version)
);

CREATE INDEX idx_forecast_scores_available
  ON public.forecast_scores (outcome_available_at DESC);

ALTER TABLE public.forecast_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corpus_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_run_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_scores ENABLE ROW LEVEL SECURITY;

-- Definitions and a user's own forecast history can be read after sign-in.
-- Raw licensed data, features, labels, inserts and scoring remain server-side.
REVOKE ALL ON public.forecast_targets, public.forecast_sources,
  public.corpus_observations, public.corpus_snapshots, public.corpus_outcomes,
  public.forecast_runs, public.forecast_run_draws, public.forecast_scores
  FROM anon, authenticated;

GRANT SELECT ON public.forecast_targets TO authenticated;
GRANT SELECT ON public.forecast_runs, public.forecast_run_draws,
  public.forecast_scores TO authenticated;
GRANT ALL ON public.forecast_targets, public.forecast_sources,
  public.corpus_observations, public.corpus_snapshots, public.corpus_outcomes,
  public.forecast_runs, public.forecast_run_draws, public.forecast_scores
  TO service_role;

CREATE POLICY "Authenticated users can read active target definitions"
  ON public.forecast_targets FOR SELECT TO authenticated
  USING (active);

CREATE POLICY "Users can read their own forecast runs"
  ON public.forecast_runs FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Users can read draws from their own forecast runs"
  ON public.forecast_run_draws FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forecast_runs r
    WHERE r.id = forecast_run_id
      AND r.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can read scores from their own forecast runs"
  ON public.forecast_scores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forecast_runs r
    WHERE r.id = forecast_run_id
      AND r.owner_id = (SELECT auth.uid())
  ));
