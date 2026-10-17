CREATE TABLE public.trade_lab_journal (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 engine_version text NOT NULL,
 dataset_hash text NOT NULL CHECK(length(dataset_hash)=64),
 decision_at timestamptz NOT NULL,
 plan jsonb NOT NULL CHECK(jsonb_typeof(plan)='object'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=4000),
 provenance text NOT NULL DEFAULT 'user_uploaded_unverified' CHECK(provenance='user_uploaded_unverified')
);
ALTER TABLE public.trade_lab_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_lab_journal FROM anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.trade_lab_journal TO authenticated;
GRANT ALL ON public.trade_lab_journal TO service_role;
CREATE POLICY "Read own practice journal" ON public.trade_lab_journal FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Insert own practice journal" ON public.trade_lab_journal FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY "Delete own practice journal" ON public.trade_lab_journal FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE INDEX trade_lab_journal_owner_time ON public.trade_lab_journal(user_id,created_at DESC);
