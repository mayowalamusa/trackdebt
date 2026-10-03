CREATE TABLE public.paystack_subaccounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subaccount_code text NOT NULL,
  business_name text NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  percentage_charge numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.paystack_subaccounts TO authenticated;
GRANT ALL ON public.paystack_subaccounts TO service_role;
ALTER TABLE public.paystack_subaccounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subaccount" ON public.paystack_subaccounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.collected_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_ref text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  reference text NOT NULL UNIQUE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collected_payments_user_unsynced ON public.collected_payments (user_id) WHERE synced_at IS NULL;
GRANT SELECT ON public.collected_payments TO authenticated;
GRANT ALL ON public.collected_payments TO service_role;
ALTER TABLE public.collected_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own collected payments" ON public.collected_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read collected payments" ON public.collected_payments FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));