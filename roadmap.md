# Track Debt — Roadmap

## In progress
- [x] Admin backend database schema (config, promo codes, announcements, roles, profiles)
- [x] Admin login + protected admin area
- [x] Admin screens: Overview, Brand, Promo Codes, Announcements, Users
- [x] Admin management centre: user controls, broadcasts, subscriptions, payment events, analytics, feature flags
- [ ] Database-backed promo redemption + active announcements in the app
- [x] Explicit visitor-local vs registered-cloud storage transition with user-controlled migration/wipe
- [x] Apply admin management migration in production Supabase and verify RLS
- [x] Seed first admin account (admin email configured)

## Security
- [x] Harden feature-flag reads, migration audit records, billing-event access, helper function privileges, and entitlement signing
- [x] Add 31-point Supabase RLS/security regression test suite
- [x] Run the security suite automatically in GitHub Actions
- [ ] Execute the full database security suite in a local/CI Supabase environment and add live two-account behavioral RLS tests

## New
- [ ] Payments: help the owner collect money (scope to confirm — Track Debt Pro subscriptions vs. debt repayments from their own customers)
