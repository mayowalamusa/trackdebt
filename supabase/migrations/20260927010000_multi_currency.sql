-- Track Debt multi-currency support.
-- Existing businesses remain NGN unless they explicitly change their currency.
alter table public.profiles
  add column if not exists currency text not null default 'NGN';

alter table public.profiles
  drop constraint if exists profiles_currency_check;

alter table public.profiles
  add constraint profiles_currency_check
  check (currency in ('NGN','GHS','KES','TZS','UGX','ZMW','RWF'));

update public.profiles
set currency = 'NGN'
where currency is null or currency not in ('NGN','GHS','KES','TZS','UGX','ZMW','RWF');
