# Fix the post-payment import screen + finish the admin area

## What's wrong today

After paying, the app shows an "Import your existing data" screen with only one button, and pressing it fails with "Could not import local data."

Cause (verified): the cloud storage area for customers, transactions, reminders and notification settings was never actually created in the backend. Only the accounts, subscription, promo code, announcement and brand tables exist. So the save-to-cloud step has nowhere to write and errors out every time.

## What I'll do

### 1. Create the missing cloud storage
Add the missing tables (customers, transactions, reminders, notification preferences, notifications, migration record) plus the extra business-profile fields, with per-user access rules so each person can only see their own records.

### 2. Make the upload automatic, remove the blocking screen
Since this is simply backing up the phone's records into the paid account, it happens silently in the background right after payment:
- No more "Import your existing data" wall — the user lands straight in the app.
- The upload runs in the background; local records stay on the phone untouched.
- A small toast confirms "Your records are now backed up to your account", or, if it fails, "Backup didn't finish — we'll retry" with a Retry option in Settings.
- Retry happens automatically on next app open until it succeeds.

### 3. Complete the admin area
A separate, login-protected admin section at `/admin`, unreachable from the normal app:
- **Sign in** — email and password; only accounts marked as admin get in, everyone else sees "Not authorised".
- **Brand details** — app name, logo URL, support email, website, description, theme colour.
- **Promo codes** — list, create, edit, activate/deactivate, set plan, duration in days, usage limit, expiry; see how many times each was used.
- **Users** — list of accounts with sign-up date, plan, subscription status; view deletion-pending accounts; grant or revoke admin.
- **Announcements** — create/edit/remove messages shown in the app, with priority, start/end dates and active toggle.
- **Overview** — totals: users, paying subscribers, active promo codes.

### 4. Make you the first admin
I need the email address of the account that should be the first admin (it must already have signed in once, or I can create it with a password you choose). Everything else can be built before that.

## Technical notes

- New migration: `customers`, `transactions`, `reminders`, `notification_preferences`, `notifications`, `migration_batches`, plus `profiles` business columns — each with GRANTs and `auth.uid()`-scoped RLS, matching the column names already used in `src/lib/cloud-data.ts`.
- `src/components/auth-gate.tsx`: drop `MigrationPrompt`; run `migrateLocalData` in a background effect with a completion flag and toast feedback; add a manual "Back up now" action in Settings.
- Admin UI under `src/routes/_authenticated/admin/*` with a public `/admin/login`; reads/writes go through server functions using `requireSupabaseAuth` and a `private.has_role(uid,'admin')` check; user listing uses the admin client server-side only.
- Tests: extend Vitest coverage for the background migration path.
