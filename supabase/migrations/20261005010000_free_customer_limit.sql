-- Enforce the Free-plan customer limit at the database boundary.
-- Existing customers are preserved; only new/unarchived active customers are limited.

alter table public.customers
  add column if not exists archived_at timestamptz;

create index if not exists customers_user_active_idx
  on public.customers (user_id)
  where archived_at is null;

alter table public.promo_redemptions
  add column if not exists user_id uuid;

create index if not exists promo_redemptions_user_idx
  on public.promo_redemptions (user_id, expires_at);

create index if not exists promo_redemptions_token_ref_idx
  on public.promo_redemptions (token_ref);

create schema if not exists private;

create or replace function private.trackdebt_has_unlimited_customers(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = _user_id
      and s.plan = 'plus'
      and s.status in ('active', 'cancelled', 'failed')
      and s.current_period_end > now()
  )
  or exists (
    select 1
    from public.promo_redemptions p
    where p.user_id = _user_id
      and p.expires_at > now()
  );
$$;

create or replace function private.trackdebt_enforce_customer_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
begin
  if new.archived_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.archived_at is null then
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.legacy_id is not null
     and exists (
       select 1
       from public.customers c
       where c.user_id = new.user_id
         and c.legacy_id = new.legacy_id
     ) then
    return new;
  end if;

  if private.trackdebt_has_unlimited_customers(new.user_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('trackdebt_customer_limit:' || new.user_id::text)
  );

  select count(*)
    into active_count
    from public.customers c
   where c.user_id = new.user_id
     and c.archived_at is null
     and c.id is distinct from new.id;

  if active_count >= 20 then
    raise exception 'customer_limit_reached'
      using errcode = 'P0001',
            hint = 'Free plan allows up to 20 active customers.';
  end if;

  return new;
end;
$$;

revoke all on function private.trackdebt_has_unlimited_customers(uuid) from public;
revoke all on function private.trackdebt_enforce_customer_limit() from public;

drop trigger if exists trackdebt_customer_limit on public.customers;

create trigger trackdebt_customer_limit
  before insert or update of archived_at on public.customers
  for each row
  execute function private.trackdebt_enforce_customer_limit();
