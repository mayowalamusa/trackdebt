-- Restrict public feature-flag reads to the single client-facing flag.
-- Admin management continues to use the service-role client, which bypasses RLS.

DROP POLICY IF EXISTS "Public can read feature flags" ON public.app_feature_flags;

CREATE POLICY "Public can read registration feature flag"
  ON public.app_feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (key = 'registration');

-- Keep all other feature flags private to privileged/server-side access.
