-- Admin management: broadcasts, privacy-friendly visitor analytics, feature flags, and payment metadata.

CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  audience text NOT NULL CHECK (audience IN ('all','free','plus')),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Admins can read broadcasts" ON public.admin_broadcasts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.site_visits (
  visitor_id text NOT NULL,
  visited_on date NOT NULL DEFAULT CURRENT_DATE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, visited_on)
);
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  label text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_feature_flags TO anon, authenticated;
GRANT ALL ON public.app_feature_flags TO service_role;
ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read feature flags" ON public.app_feature_flags;
CREATE POLICY "Public can read feature flags" ON public.app_feature_flags FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.app_feature_flags;
CREATE POLICY "Admins can manage feature flags" ON public.app_feature_flags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_feature_flags (key, enabled, label, description) VALUES
  ('registration', false, 'New registrations', 'Allow new users to create Track Debt accounts.'),
  ('plus_checkout', false, 'Plus checkout', 'Allow users to start Plus checkout.'),
  ('maintenance', false, 'Maintenance mode', 'Show the maintenance state to app users.'),
  ('ads', true, 'Advertising', 'Allow eligible advertising surfaces.'),
  ('ai_reminders', true, 'AI reminders', 'Allow AI reminder generation for eligible plans.'),
  ('whatsapp_tools', true, 'WhatsApp tools', 'Allow WhatsApp reminder tools for eligible plans.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.subscription_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.subscription_events ADD COLUMN IF NOT EXISTS amount integer;
ALTER TABLE public.subscription_events ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.subscription_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS subscription_events_user_id_idx ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS subscription_events_created_at_idx ON public.subscription_events(created_at DESC);