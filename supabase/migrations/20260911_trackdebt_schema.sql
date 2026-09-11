create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  business_logo_path text,
  business_phone text not null default '',
  business_address text not null default '',
  business_email text not null default '',
  business_category text not null default '',
  bank_name text not null default '',
  account_number text not null default '',
  account_name text not null default '',
  onboarding_completed boolean not null default false,
  onboarding_tips jsonb not null default '{"addCustomer":false,"openCustomer":false}'::jsonb,
  account_status text not null default 'active' check (account_status in ('active','deletion_pending','deleted')),
  deletion_requested_at timestamptz,
  restorable_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  legacy_id text,
  name text not null,
  phone text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  legacy_id text,
  type text not null check (type in ('sale','payment')),
  kind text check (kind in ('full','partial')),
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null,
  note text not null default '',
  reference text,
  term_key text check (term_key in ('none','today','d7','d14','d30','custom')),
  due_date date,
  term_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  legacy_id text,
  customer_name text not null default '',
  template_id text not null,
  tone text,
  message text not null,
  status text not null check (status in ('prepared','sent','cancelled')),
  created_at timestamptz not null,
  sent_at timestamptz,
  unique (user_id, legacy_id)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  remind_7_days_before boolean not null default false,
  remind_3_days_before boolean not null default true,
  remind_1_day_before boolean not null default true,
  remind_on_due_date boolean not null default true,
  remind_overdue boolean not null default true,
  overdue_interval_days integer not null default 3,
  reminder_time text not null default '09:00',
  daily_reminder_enabled boolean not null default true,
  daily_reminder_time text not null default '19:00',
  weekly_summary_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  legacy_id text,
  type text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null,
  scheduled_for timestamptz not null,
  read boolean not null default false,
  status text not null check (status in ('scheduled','delivered','cancelled')),
  unique (user_id, legacy_id)
);

create table if not exists public.receipt_sequences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  next_number integer not null default 1 check (next_number > 0),
  primary key (user_id, year)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','plus')),
  status text not null default 'free' check (status in ('free','active','cancelled','failed','expired')),
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  paystack_authorization jsonb,
  last_transaction_reference text,
  amount integer,
  currency text,
  subscription_start_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancellation_at timestamptz,
  last_successful_payment_at timestamptz,
  next_expected_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_events (
  event_id text primary key,
  event_name text not null,
  reference text,
  payload_hash text,
  received_at timestamptz not null default now()
);

create table if not exists public.migration_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'localStorage',
  source_version integer not null default 1,
  status text not null check (status in ('started','completed','failed')),
  imported_customers integer not null default 0,
  imported_transactions integer not null default 0,
  imported_reminders integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.trackdebt_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','customers','transactions','subscriptions'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.trackdebt_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.receipt_sequences enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.migration_batches enable row level security;

create or replace function public.trackdebt_is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'active'
  );
$$;

create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users create active profile" on public.profiles for insert with check (id = auth.uid() and account_status = 'active');
create policy "users update active profile" on public.profiles for update using (id = auth.uid() and account_status = 'active') with check (id = auth.uid() and account_status = 'active');
create policy "users own customers" on public.customers for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users own transactions" on public.transactions for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users own reminders" on public.reminders for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users own preferences" on public.notification_preferences for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users own notifications" on public.notifications for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users own receipt sequence" on public.receipt_sequences for all using (user_id = auth.uid() and public.trackdebt_is_active_user()) with check (user_id = auth.uid());
create policy "users read own subscription" on public.subscriptions for select using (user_id = auth.uid() and public.trackdebt_is_active_user());
create policy "users read own migration batches" on public.migration_batches for select using (user_id = auth.uid());

-- Writes to billing, webhook, event, and migration records use server-only service role code.