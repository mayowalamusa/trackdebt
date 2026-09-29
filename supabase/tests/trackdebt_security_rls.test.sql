begin;

select plan(31);

-- RLS must remain enabled on every client-facing Track Debt data table.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  'customers has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
  'transactions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reminders'::regclass),
  'reminders has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass),
  'notification_preferences has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.receipt_sequences'::regclass),
  'receipt_sequences has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass),
  'subscriptions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.subscription_events'::regclass),
  'subscription_events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.migration_batches'::regclass),
  'migration_batches has RLS enabled'
);

-- The core ownership policies must exist and apply to authenticated users.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'users own customers'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'customers ownership policy is present'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'users own transactions'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'transactions ownership policy is present'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reminders'
      and policyname = 'users own reminders'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'reminders ownership policy is present'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'users own notifications'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'notifications ownership policy is present'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'users own preferences'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'notification preferences ownership policy is present'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_sequences'
      and policyname = 'users own receipt sequence'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
  ),
  'receipt sequence ownership policy is present'
);

-- Sensitive tables must not expose broad authenticated access.
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'subscription_events'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ),
  'authenticated users cannot directly read subscription_events'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'migration_batches'
      and grantee = 'authenticated'
      and privilege_type in ('UPDATE', 'DELETE')
  ),
  'authenticated users cannot update or delete migration_batches'
);

-- Feature flags must expose only the registration flag to public clients.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_feature_flags'
      and policyname = 'Public can read registration feature flag'
      and cmd = 'SELECT'
      and roles @> array['anon'::name, 'authenticated'::name]
      and qual::text like '%key = ''registration''%'
  ),
  'public feature-flag policy is restricted to registration'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_feature_flags'
      and policyname = 'Public can read feature flags'
  ),
  'legacy broad public feature-flag policy is absent'
);

-- The active-user helper must be a security-definer function and must not be
-- executable by PUBLIC. This protects ownership checks from privilege drift.
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'trackdebt_is_active_user'
      and p.prosecdef
  ),
  'trackdebt_is_active_user is security definer'
);

select ok(
  not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'trackdebt_is_active_user'
      and grantee = 'PUBLIC'
      and privilege_type = 'EXECUTE'
  ),
  'trackdebt_is_active_user is not executable by PUBLIC'
);

-- Timestamp trigger helpers must not remain publicly executable.
select ok(
  not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'trackdebt_updated_at'
      and grantee = 'PUBLIC'
      and privilege_type = 'EXECUTE'
  ),
  'trackdebt_updated_at is not executable by PUBLIC'
);

-- Service-only billing writes must not accidentally become client writes.
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and roles @> array['anon'::name]
  ),
  'subscriptions has no anonymous policy'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_events'
      and roles @> array['anon'::name]
  ),
  'subscription_events has no anonymous policy'
);

-- Verify the ownership predicates actually reference auth.uid().
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'users own customers'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'customers policy is bound to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
      and policyname = 'users own transactions'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'transactions policy is bound to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reminders'
      and policyname = 'users own reminders'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'reminders policy is bound to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'users own notifications'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'notifications policy is bound to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'users own preferences'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'notification preferences policy is bound to auth.uid()'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_sequences'
      and policyname = 'users own receipt sequence'
      and (qual::text like '%auth.uid()%' or with_check::text like '%auth.uid()%')
  ),
  'receipt sequence policy is bound to auth.uid()'
);

select * from finish();

rollback;
