-- Defense-in-depth hardening for the public database surface.
-- RLS remains the primary ownership boundary; these grants further reduce
-- what an authenticated client can mutate or read directly.

-- Migration batches are client-readable/creatable audit records, not client-editable state.
REVOKE UPDATE, DELETE ON public.migration_batches FROM authenticated;
DROP POLICY IF EXISTS "users own migration batches" ON public.migration_batches;
DROP POLICY IF EXISTS "users read own migration batches" ON public.migration_batches;
DROP POLICY IF EXISTS "users create own migration batches" ON public.migration_batches;

CREATE POLICY "users read own migration batches"
  ON public.migration_batches
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users create own migration batches"
  ON public.migration_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Webhook event history is server/admin data. No normal user needs direct reads.
REVOKE SELECT ON public.subscription_events FROM authenticated;

-- This helper is only an RLS implementation detail. It should not be callable
-- by anonymous clients or arbitrary database roles.
REVOKE ALL ON FUNCTION public.trackdebt_is_active_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trackdebt_is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trackdebt_is_active_user() TO service_role;

-- Trigger helpers are not application APIs.
REVOKE ALL ON FUNCTION public.trackdebt_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
