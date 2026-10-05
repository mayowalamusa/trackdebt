ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS customers_user_active_idx ON public.customers (user_id) WHERE archived_at IS NULL;

ALTER TABLE public.promo_redemptions ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON public.promo_redemptions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS promo_redemptions_token_ref_idx ON public.promo_redemptions (token_ref);

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.trackdebt_has_unlimited_customers(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND s.plan = 'plus'
      AND s.status IN ('active','cancelled','failed')
      AND s.current_period_end > now()
  ) OR EXISTS (
    SELECT 1 FROM public.promo_redemptions p
    WHERE p.user_id = _user_id
      AND p.expires_at > now()
  )
$$;

CREATE OR REPLACE FUNCTION private.trackdebt_enforce_customer_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count integer;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.archived_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- Upserts fire BEFORE INSERT for rows that will resolve to an update; existing rows are not new customers.
  IF TG_OP = 'INSERT' AND NEW.legacy_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.user_id = NEW.user_id AND c.legacy_id = NEW.legacy_id
  ) THEN
    RETURN NEW;
  END IF;
  IF private.trackdebt_has_unlimited_customers(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('trackdebt_customer_limit:' || NEW.user_id::text));
  SELECT count(*) INTO active_count FROM public.customers c
  WHERE c.user_id = NEW.user_id AND c.archived_at IS NULL AND c.id IS DISTINCT FROM NEW.id;
  IF active_count >= 20 THEN
    RAISE EXCEPTION 'customer_limit_reached' USING ERRCODE = 'P0001', HINT = 'Free plan allows up to 20 active customers.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.trackdebt_has_unlimited_customers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.trackdebt_enforce_customer_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trackdebt_customer_limit ON public.customers;
CREATE TRIGGER trackdebt_customer_limit
  BEFORE INSERT OR UPDATE OF archived_at ON public.customers
  FOR EACH ROW EXECUTE FUNCTION private.trackdebt_enforce_customer_limit();