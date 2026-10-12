-- Operational state is server-owned. Existing rows are retained without guessing ownership.
DO $$ DECLARE t text; p record;
BEGIN
 FOREACH t IN ARRAY ARRAY['warm_state','trade_history','synthesis_history','kill_switch_alerts','tor_entries'] LOOP
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 -- Only curated discovery entries are directly readable by signed-in accounts.
 GRANT SELECT ON public.tor_entries TO authenticated;
 CREATE POLICY "Signed in read discovery entries" ON public.tor_entries FOR SELECT TO authenticated USING(true);
END $$;

