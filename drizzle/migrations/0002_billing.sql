-- Staged billing integration. Apply only to the configured project through its release process.
CREATE TABLE public.billing_customers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 stripe_customer_id text UNIQUE NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.billing_checkout_attempts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE public.billing_webhook_events (
 event_id text PRIMARY KEY, user_id uuid NOT NULL, stripe_created bigint NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_id_unique ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_customers,public.billing_checkout_attempts,public.billing_webhook_events FROM anon,authenticated;
GRANT ALL ON public.billing_customers,public.billing_checkout_attempts,public.billing_webhook_events TO service_role;
CREATE FUNCTION public.vv_claim_checkout(p_user_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.billing_checkout_attempts;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 IF EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=p_user_id AND status IN ('active','trialing','past_due','unpaid','incomplete')) THEN RETURN NULL; END IF;
 SELECT * INTO row FROM public.billing_checkout_attempts WHERE user_id=p_user_id;
 IF FOUND AND row.expires_at>now() THEN RETURN to_jsonb(row); END IF;
 INSERT INTO public.billing_checkout_attempts(user_id,request_id,expires_at) VALUES(p_user_id,p_request_id,date_trunc('second',now())+interval '1 hour')
 ON CONFLICT(user_id) DO UPDATE SET request_id=excluded.request_id,expires_at=excluded.expires_at RETURNING * INTO row;
 RETURN to_jsonb(row);
END;$$;
CREATE FUNCTION public.vv_apply_billing_event(p_event_id text,p_created bigint,p_user_id uuid,p_snapshot jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted integer; existing public.subscriptions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.billing_customers WHERE user_id=p_user_id AND stripe_customer_id=p_snapshot->>'customer') THEN RAISE EXCEPTION 'Invalid customer binding'; END IF;
 INSERT INTO public.billing_webhook_events(event_id,user_id,stripe_created) VALUES(p_event_id,p_user_id,p_created) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=0 THEN RETURN 'duplicate'; END IF;
 SELECT * INTO existing FROM public.subscriptions WHERE user_id=p_user_id;
 IF FOUND AND existing.stripe_subscription_id IS DISTINCT FROM p_snapshot->>'subscription' AND existing.status IN ('active','trialing') AND p_snapshot->>'status' NOT IN ('active','trialing') THEN RETURN 'stale'; END IF;
 IF FOUND AND (existing.stripe_event_created>p_created OR (existing.stripe_event_created=p_created AND existing.stripe_subscription_id=p_snapshot->>'subscription' AND existing.status IN ('canceled','unpaid') AND p_snapshot->>'status' IN ('active','trialing'))) THEN RETURN 'stale'; END IF;
 INSERT INTO public.subscriptions(user_id,status,plan,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_end,trial_end,cancel_at_period_end,stripe_event_created)
 VALUES(p_user_id,p_snapshot->>'status','membership',p_snapshot->>'customer',p_snapshot->>'subscription',p_snapshot->>'price',(p_snapshot->>'period_end')::timestamptz,(p_snapshot->>'trial_end')::timestamptz,(p_snapshot->>'cancel_at_period_end')::boolean,p_created)
 ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,plan=excluded.plan,stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,stripe_price_id=excluded.stripe_price_id,current_period_end=excluded.current_period_end,trial_end=excluded.trial_end,cancel_at_period_end=excluded.cancel_at_period_end,stripe_event_created=excluded.stripe_event_created,updated_at=now();
 RETURN 'applied';
END;$$;
REVOKE ALL ON FUNCTION public.vv_claim_checkout(uuid,uuid),public.vv_apply_billing_event(text,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vv_claim_checkout(uuid,uuid),public.vv_apply_billing_event(text,bigint,uuid,jsonb) TO service_role;
