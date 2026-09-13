-- Business profile fields used by the app's cloud sync
alter table public.profiles add column if not exists business_name text not null default '';
alter table public.profiles add column if not exists business_logo_path text;
alter table public.profiles add column if not exists business_phone text not null default '';
alter table public.profiles add column if not exists business_address text not null default '';
alter table public.profiles add column if not exists business_email text not null default '';
alter table public.profiles add column if not exists business_category text not null default '';
alter table public.profiles add column if not exists bank_name text not null default '';
alter table public.profiles add column if not exists account_number text not null default '';
alter table public.profiles add column if not exists account_name text not null default '';
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists onboarding_tips jsonb not null default '{"addCustomer":false,"openCustomer":false,"reminder":false}'::jsonb;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  legacy_id text,
  name text not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "users own customers" on public.customers for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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
create index if not exists transactions_customer_idx on public.transactions(customer_id);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "users own transactions" on public.transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  legacy_id text,
  customer_name text not null default '',
  template_id text not null default '',
  tone text,
  message text not null default '',
  status text not null default 'prepared',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, legacy_id)
);
grant select, insert, update, delete on public.reminders to authenticated;
grant all on public.reminders to service_role;
alter table public.reminders enable row level security;
create policy "users own reminders" on public.reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "users own preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  legacy_id text,
  type text not null default '',
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now(),
  read boolean not null default false,
  status text not null default 'scheduled',
  unique (user_id, legacy_id)
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "users own notifications" on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.receipt_sequences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  next_number integer not null default 1 check (next_number > 0),
  primary key (user_id, year)
);
grant select, insert, update, delete on public.receipt_sequences to authenticated;
grant all on public.receipt_sequences to service_role;
alter table public.receipt_sequences enable row level security;
create policy "users own receipt sequence" on public.receipt_sequences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.migration_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'localStorage',
  source_version integer not null default 1,
  status text not null default 'completed',
  imported_customers integer not null default 0,
  imported_transactions integer not null default 0,
  imported_reminders integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, source, source_version)
);
grant select, insert, update, delete on public.migration_batches to authenticated;
grant all on public.migration_batches to service_role;
alter table public.migration_batches enable row level security;
create policy "users own migration batches" on public.migration_batches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists update_customers_updated_at on public.customers;
create trigger update_customers_updated_at before update on public.customers for each row execute function public.update_updated_at_column();
drop trigger if exists update_transactions_updated_at on public.transactions;
create trigger update_transactions_updated_at before update on public.transactions for each row execute function public.update_updated_at_column();
