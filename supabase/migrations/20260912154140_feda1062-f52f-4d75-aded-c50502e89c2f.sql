CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','plus')),
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','active','cancelled','failed','expired')),
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_authorization jsonb,
  last_transaction_reference text,
  amount integer,
  currency text,
  subscription_start_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancellation_at timestamptz,
  last_successful_payment_at timestamptz,
  next_expected_payment_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_code_idx ON public.subscriptions (paystack_customer_code);
CREATE INDEX IF NOT EXISTS subscriptions_subscription_code_idx ON public.subscriptions (paystack_subscription_code);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscription_events (
  event_id text PRIMARY KEY,
  event_name text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read subscription events" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','deletion_pending','deleted'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restorable_until timestamptz;
