# Pre-launch audit + Free plan limit (20 active customers)

## Audit findings (current state, confirmed by reading code)

- Customers live in one React state array in `src/routes/index.tsx` (`addCustomer`, ~line 736), persisted via `src/lib/use-ledger-storage.ts`, and pushed to the cloud by `src/lib/cloud-data.ts` (upsert on `user_id,legacy_id`).
- `Customer` (`src/lib/ledger.ts`) has no archived/active field. There is no concept of an "active" customer today.
- Plan is decided on the client by `useEntitlements` + `resolvePlan` (`src/lib/subscription.ts`), fed by the server entitlement (`/api/paystack/status`) and signed promo tokens. Server is the source of truth only for paid server features (AI, Paystack collect).
- `customers` table RLS: `user_id = auth.uid() and trackdebt_is_active_user()`. No row cap exists.
- `/upgrade` uses `COMPARISON` in `src/lib/app-config.ts`; no customer-limit row.
- `src/lib/subscription.ts` still contains a dead `paymentService` stub and legacy "pro" naming.
- `roadmap.md` "Payments" item is stale (already built).

## Assumption to confirm

"Active" = not archived. I will add an Archive / Unarchive action per customer. Archived customers keep their history, are hidden from the main list by default (new "Archived" filter), and do not count toward the 20. Deleting also frees a slot. Existing users already over 20 keep everything; they just can't add more (or unarchive) until under the limit or on Plus.

## Changes

1. Config — `src/lib/app-config.ts`
   - `FREE_ACTIVE_CUSTOMER_LIMIT = 20`; add `maxActiveCustomers` to plan definitions (Free 20, Plus/Premium unlimited).
   - Add "Active customers: 20 / Unlimited" row to `COMPARISON` (needs a text-value variant, not just boolean).
2. Entitlements — `src/lib/subscription.ts`
   - `getEntitlements` returns `maxActiveCustomers: number | null`.
   - Remove the dead `paymentService` stub.
3. Model — `src/lib/ledger.ts`
   - `Customer.archivedAt?: string`; helpers `isActiveCustomer`, `countActiveCustomers`, `canAddActiveCustomer(customers, entitlements)`.
4. App screen — `src/routes/index.tsx`
   - Guard `addCustomer` and unarchive with `canAddActiveCustomer`; on block, show a toast + link to `/upgrade`.
   - "New customer" button shows "18 / 20 active" for Free users; disabled state with upgrade prompt at the limit.
   - Archive/Unarchive in customer detail; "Archived" option in list filter; dashboard stats exclude archived (balances still counted, so no money disappears).
   - Voice entry / any other path that creates customers goes through the same helper.
5. Upgrade page — `src/routes/upgrade.tsx`
   - Free card: "Up to 20 active customers". Plus card: "Unlimited customers". Comparison table shows the new row. Optional banner when the user is at the limit.
6. Cloud — migration (new file in `supabase/migrations/`)
   - `alter table public.customers add column archived_at timestamptz`.
   - Server-side enforcement trigger: on insert, or on update that clears `archived_at`, reject when user is not Plus (via `subscriptions`, same rule as `isPlusEntitled`) and already has 20 active rows. Security-definer function in `private` schema.
   - `src/lib/cloud-data.ts`: map `archived_at` both ways; surface the limit error as a friendly message instead of failing the whole sync.
7. Cleanup/bugs to fix in the same pass
   - `auth-gate.tsx`: `hasLocalBusinessData()` called during render on every pass (reads localStorage repeatedly); memoize.
   - Cloud sync pushes upserts but never removes deleted customers in the cloud, so deleted customers reappear on another device. Add delete propagation.
   - Update `roadmap.md` (mark Payments done, add customer limit).
8. Tests (Vitest)
   - `ledger.test.ts`: active count, archived excluded, limit boundary at 19/20/21, unlimited for Plus/Premium.
   - `app-config.test.ts`: comparison row and limits.
   - SQL test addition in `supabase/tests/trackdebt_security_rls.test.sql` for the trigger.
   - Run typecheck, all tests, build; Playwright: add 20 customers on Free, confirm the 21st is blocked and `/upgrade` shows the limit.

## Risks

- Client limit can be bypassed by editing local storage for signed-out users; that's acceptable (local-only data, nothing costs us). The database trigger enforces it for signed-in cloud accounts.
- Promo-based Plus is only a signed token, not in `subscriptions`; the trigger would treat promo users as Free. Mitigation: record promo entitlements server-side (write to `subscriptions` with an expiry on redeem) or skip the trigger for users with an active promo redemption. I'll use the `promo_redemptions` expiry check.
- Users who lapse from Plus with more than 20 customers: nothing is deleted or hidden; only adding is blocked. Must be clear in copy.
- Local-to-cloud migration of over 20 customers for a Free user would hit the trigger; migration will import them as-is (trigger bypassed for the migration batch marker) so no data is lost.
- `src/routes/index.tsx` is very large (130 KB); edits will be small and targeted to limit regression risk.
