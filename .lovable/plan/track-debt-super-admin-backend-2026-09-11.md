# Track Debt — Super Admin Backend

## Goal
Add a secure web admin panel at `/admin` so the owner can manage global app settings without changing the existing mobile debt-tracker experience.

## Scope decisions from your answers
- The main Track Debt app stays anonymous/offline (localStorage).
- Only the new admin panel requires login.
- Admin controls: Brand details, Promo codes, Announcements, and User management.
- Admin access starts with one email (yours); other admins can be promoted later from the panel.

## What will be built

### 1. Database (Lovable Cloud / Supabase)
New tables with RLS and GRANTs:
- `app_config` — single row for app name, logo, support email, website, developer, description, theme color.
- `promo_codes` — code, plan, days, max uses, usage count, expiry, active flag.
- `promo_redemptions` — anonymous redemptions tied to issued entitlement token refs.
- `announcements` — message, link, active window, priority.
- `user_roles` — RBAC (`admin` role) referencing `auth.users`.
- `profiles` — optional display names for any account.
- Security-definer `has_role()` helper and an `updated_at` trigger.

### 2. Admin access
- Login page at `/admin/login` using email + password (Supabase auth).
- Protected admin shell under `/admin`.
- Role check on every admin server function.
- First admin seeded to your email address.

### 3. Admin sections
- **Dashboard** — counts (promo codes, redemptions, active announcements).
- **Brand** — edit app name, logo URL, support email, website, developer, description, theme color.
- **Promo codes** — create, edit, disable, delete, view redemptions.
- **Announcements** — create, edit, schedule, activate/deactivate.
- **Users** — list auth accounts, view role/redemptions, disable/enable, send password reset, promote/demote admin.

### 4. Public-facing updates
- Promo redemption endpoint will read from the database table instead of environment variables.
- New public endpoint to fetch active announcements for the app to display.

### 5. Existing app
- No redesign of the debt tracker UI.
- Existing localStorage ledger, receipts, reminders stay untouched.

## Open question before seeding
I need the email address that should be the first admin. Please reply with the email you want to use to log into `/admin`.

## Validation
- Type check, Vitest tests, production build pass.
- Admin login and each CRUD flow tested in the browser.
- Promo redemption still works with the database-backed codes.
