-- Harden trackdebt_is_active_user() only if it exists.
DO $$
BEGIN
  IF to_regprocedure('public.trackdebt_is_active_user()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.trackdebt_is_active_user() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.trackdebt_is_active_user() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.trackdebt_is_active_user() TO service_role;
  END IF;
END
$$;

-- Harden timestamp helper functions only if they exist.
DO $$
BEGIN
  IF to_regprocedure('public.trackdebt_updated_at()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.trackdebt_updated_at() FROM PUBLIC;
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
  END IF;
END
$$;
