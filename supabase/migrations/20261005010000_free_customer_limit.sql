-- Final customer-plan hardening
-- Free accounts may keep existing records, but only 20 unarchived customers.
-- Plus/Premium and active signed promo entitlements are unlimited.

alter table public.customers
  add column if not exists archived_at timestamptz;

alter table public.promo_redemptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists promo_redemptions_user_expires_idx
  on public.promo_redemptions (user_id, expires_at);

create or replace function private.trackdebt_has_unlimited_customers(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = target_user
      and s.plan = 'plus'
      and s.current_period_end is not null
      and s.current_period_end > now()
      and s.status in ('active', 'cancelled', 'failed')
  )
  or exists (
    select 1
    from public.promo_redemptions r
    where r.user_id = target_user
      and r.expires_at is not null
      and r.expires_at > now()
      and coalesce(r.metadata ->> 'plan', '') in ('plus', 'premium')
  );
$$;

create or replace function private.trackdebt_enforce_customer_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $
declare
  active_count integer;
begin
  -- Service-role/server migrations are trusted. Authenticated browser writes
  -- always have auth.uid(), so the plan check applies to normal app traffic.
  if auth.uid() is null then
    return new;
  end if;

  if private.trackdebt_has_unlimited_customers(new.user_id) then
    return new;
  end if;

  -- Serialize customer writes per account so two simultaneous inserts cannot
  -- both observe 19 active customers and create a 21st.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if new.archived_at is null then
    select count(*)::integer
      into active_count
      from public.customers
     where user_id = new.user_id
       and archived_at is null
       and (tg_op = 'INSERT' or id <> new.id);

    if active_count >= 20 then
      raise exception using
        errcode = 'check_violation',
        message = 'customer_limit_reached',
        detail = 'Free accounts can have up to 20 active customers. Archive a customer or upgrade to Plus.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trackdebt_customer_limit on public.customers;

create trigger trackdebt_customer_limit
before insert or update of archived_at on public.customers
for each row
execute function public.trackdebt_enforce_customer_limit();

revoke all on function private.trackdebt_has_unlimited_customers(uuid) from public, anon, authenticated;
revoke all on function private.trackdebt_enforce_customer_limit() from public, anon, authenticated;

-- The trigger executes these functions internally; no direct client execution is needed.
