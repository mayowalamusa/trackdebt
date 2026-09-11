alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deletion_expires_at timestamptz;

create table if not exists public.account_cleanup_runs (
  user_id uuid primary key,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running','completed','failed')),
  error_message text
);

alter table public.account_cleanup_runs enable row level security;

create or replace function public.trackdebt_request_account_deletion(target_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare expires_at timestamptz;
begin
  expires_at := now() + interval '30 days';
  update public.profiles
  set account_status = 'deletion_pending',
      deletion_requested_at = now(),
      restorable_until = expires_at,
      deleted_at = now(),
      deletion_expires_at = expires_at
  where id = target_user and account_status <> 'deleted';
  return expires_at;
end;
$$;

create or replace function public.trackdebt_restore_account(target_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare current_status text; deadline timestamptz;
begin
  select account_status, restorable_until into current_status, deadline
  from public.profiles where id = target_user;
  if current_status is null then return 'not_found'; end if;
  if current_status = 'active' then return 'active'; end if;
  if current_status = 'deleted' or deadline is null or deadline <= now() then return 'expired'; end if;
  update public.profiles
  set account_status = 'active',
      deletion_requested_at = null,
      restorable_until = null,
      deleted_at = null,
      deletion_expires_at = null
  where id = target_user;
  return 'restored';
end;
$$;

create or replace function public.trackdebt_cleanup_deleted_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare account record; cleaned integer := 0;
begin
  for account in
    select id from public.profiles
    where account_status = 'deletion_pending'
      and deleted_at is not null
      and deletion_expires_at is not null
      and deletion_expires_at <= now()
  loop
    insert into public.account_cleanup_runs(user_id, status)
    values (account.id, 'running')
    on conflict (user_id) do update set attempted_at = now(), status = 'running', error_message = null;
    begin
      delete from auth.users where id = account.id;
      update public.account_cleanup_runs set status = 'completed', completed_at = now() where user_id = account.id;
      cleaned := cleaned + 1;
    exception when others then
      update public.account_cleanup_runs set status = 'failed', error_message = sqlerrm where user_id = account.id;
    end;
  end loop;
  return cleaned;
end;
$$;

revoke all on function public.trackdebt_request_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.trackdebt_restore_account(uuid) from public, anon, authenticated;
revoke all on function public.trackdebt_cleanup_deleted_accounts() from public, anon, authenticated;
grant execute on function public.trackdebt_request_account_deletion(uuid) to service_role;
grant execute on function public.trackdebt_restore_account(uuid) to service_role;
grant execute on function public.trackdebt_cleanup_deleted_accounts() to service_role;

-- Supabase deployments with pg_cron enabled run cleanup even when the user never returns.
create extension if not exists pg_cron;
select cron.schedule(
  'trackdebt-cleanup-deleted-accounts',
  '0 3 * * *',
  $$select public.trackdebt_cleanup_deleted_accounts();$$
)
where not exists (
  select 1 from cron.job where jobname = 'trackdebt-cleanup-deleted-accounts'
);