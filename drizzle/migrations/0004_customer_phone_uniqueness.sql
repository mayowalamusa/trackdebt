CREATE OR REPLACE FUNCTION public.customer_phone_key(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN d IS NULL OR length(d) < 7 OR length(d) > 15 THEN NULL
    WHEN d ~ '^234[0-9]{10}$' THEN '0' || substr(d, 4)
    WHEN d ~ '^00234[0-9]{10}$' THEN '0' || substr(d, 6)
    ELSE d END
  FROM (SELECT nullif(regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g'), '') AS d) s
$$;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone_key text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone_conflict boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.customers.phone_conflict IS 'TRUE for legacy rows that duplicated another customer phone before uniqueness was enforced; needs manual merge.';

UPDATE public.customers SET phone_key = public.customer_phone_key(phone);

UPDATE public.customers c SET phone_conflict = true
FROM (
  SELECT id, row_number() OVER (PARTITION BY user_id, phone_key ORDER BY created_at, id) AS rn
  FROM public.customers WHERE phone_key IS NOT NULL
) r WHERE r.id = c.id AND r.rn > 1;

CREATE OR REPLACE FUNCTION public.set_customer_phone_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.phone_key := public.customer_phone_key(NEW.phone);
  IF TG_OP = 'UPDATE' AND NEW.phone_key IS DISTINCT FROM OLD.phone_key THEN
    NEW.phone_conflict := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_phone_key ON public.customers;
CREATE TRIGGER customers_phone_key BEFORE INSERT OR UPDATE OF phone ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_customer_phone_key();

CREATE UNIQUE INDEX IF NOT EXISTS customers_user_phone_key_unique
ON public.customers (user_id, phone_key)
WHERE phone_key IS NOT NULL AND phone_conflict = false;