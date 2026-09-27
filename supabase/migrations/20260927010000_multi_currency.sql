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


alter table public.transactions
  add column if not exists currency text not null default 'NGN',
  add column if not exists original_amount numeric(14,2),
  add column if not exists original_currency text;

alter table public.transactions drop constraint if exists transactions_currency_check;
alter table public.transactions add constraint transactions_currency_check
  check (currency in ('NGN','GHS','KES','TZS','UGX','ZMW','RWF'));

alter table public.transactions drop constraint if exists transactions_original_currency_check;
alter table public.transactions add constraint transactions_original_currency_check
  check (original_currency is null or original_currency in ('NGN','GHS','KES','TZS','UGX','ZMW','RWF'));

update public.transactions
set original_amount = coalesce(original_amount, amount),
    original_currency = coalesce(original_currency, currency, 'NGN')
where original_amount is null or original_currency is null;
