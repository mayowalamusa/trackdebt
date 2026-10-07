UPDATE public.subscriptions
SET current_period_end = COALESCE(last_successful_payment_at, current_period_start, updated_at) + interval '31 days',
    next_expected_payment_at = COALESCE(next_expected_payment_at, COALESCE(last_successful_payment_at, current_period_start, updated_at) + interval '31 days')
WHERE plan = 'plus' AND status = 'active' AND current_period_end IS NULL;