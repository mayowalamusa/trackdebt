-- Defense-in-depth RLS hardening.
-- Apply after the existing Track Debt schema migrations.
-- No user data is changed or deleted by this migration.

-- Ensure active-account checks apply to writes as well as updates/deletes.
drop policy if exists "users own customers" on public.customers;
create policy "users own customers" on public.customers
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (user_id = auth.uid() and public.trackdebt_is_active_user());

drop policy if exists "users own transactions" on public.transactions;
create policy "users own transactions" on public.transactions
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (
    user_id = auth.uid()
    and public.trackdebt_is_active_user()
    and exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "users own reminders" on public.reminders;
create policy "users own reminders" on public.reminders
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (
    user_id = auth.uid()
    and public.trackdebt_is_active_user()
    and (
      customer_id is null
      or exists (
        select 1 from public.customers c
        where c.id = customer_id and c.user_id = auth.uid()
      )
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = auth.uid()
      )
    )
  );

drop policy if exists "users own preferences" on public.notification_preferences;
create policy "users own preferences" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (user_id = auth.uid() and public.trackdebt_is_active_user());

drop policy if exists "users own notifications" on public.notifications;
create policy "users own notifications" on public.notifications
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (
    user_id = auth.uid()
    and public.trackdebt_is_active_user()
    and (
      customer_id is null
      or exists (
        select 1 from public.customers c
        where c.id = customer_id and c.user_id = auth.uid()
      )
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = auth.uid()
      )
    )
  );

drop policy if exists "users own receipt sequence" on public.receipt_sequences;
create policy "users own receipt sequence" on public.receipt_sequences
  for all to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user())
  with check (user_id = auth.uid() and public.trackdebt_is_active_user());

drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own subscription" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user());

drop policy if exists "users read own migration batches" on public.migration_batches;
create policy "users read own migration batches" on public.migration_batches
  for select to authenticated
  using (user_id = auth.uid() and public.trackdebt_is_active_user());

drop policy if exists "users create own migration batches" on public.migration_batches;
create policy "users create own migration batches" on public.migration_batches
  for insert to authenticated
  with check (user_id = auth.uid() and public.trackdebt_is_active_user());

-- Private billing/event tables intentionally remain writable only by server-side
-- service-role code; do not grant browser clients INSERT/UPDATE/DELETE access.
