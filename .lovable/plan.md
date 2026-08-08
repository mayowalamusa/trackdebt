# Track Debt — Phases 1–3 in one build

Continue from the current app. No rebuild: same ledger paper/ink design system, same single-page navigation model, same local storage data. Existing customers, transactions and business profile are migrated in place, never wiped.

## Phase 1 — Payment terms, branding, settings, offline

**Remove** the Recent Activity section from the dashboard.

**Payment terms & due dates**
- Every credit sale gets an optional `dueDate` plus a `terms` label, stored on the transaction itself (a separate `paymentTerm` object per sale, so future invoices/credit-terms/forecasting can attach to it without a rewrite).
- Quick options when recording a sale: Due Today, 7 days, 14 days, 30 days, Custom date, or No due date.
- Overdue is computed from the due date only — never from last-transaction date. A customer is overdue when balance > ₦0 **and** today is past the earliest unpaid sale's due date.

**Status display**
- Badges everywhere (customer list, customer detail, transaction rows): Due Today / Due Tomorrow / Due in X Days / Overdue by X Days.
- Green = not due yet, Orange = due soon (within 3 days), Red = overdue, neutral = no due date.

**Dashboard** — summary cards for Due Today, Due This Week, Overdue Customers (replacing the removed activity feed area).

**Branding** — "Track Debt" everywhere: browser title, metadata, splash/loading screen, PWA manifest, install prompt, Android display name. Uploaded icon becomes the favicon, app icon and maskable PWA icon, on white for splash.

**Settings page** — Business Profile, About Track Debt, Privacy Policy, Terms of Use, Contact Support, Upgrade to Pro.

**About page** — logo, app version, description, developer info, website + social placeholders.

**Offline** — installable PWA that works fully offline; subtle "Offline" indicator when the connection drops.

**Accessibility** — minimum 44px touch targets, larger readable type, stronger contrast, labelled icon buttons, focus rings, live regions for status changes.

## Phase 2 — Reminders and receipts

**Smart WhatsApp reminders** — every outstanding customer/transaction gets a Remind action. Message auto-builds from customer name, business name, outstanding amount, original amount, due date and days overdue, and switches wording between Not Yet Due / Due Today / Overdue.

**Reminder preview screen** — shows customer, balance, due date, status and the generated message. Actions: Edit Message, Generate with AI, Send via WhatsApp, Cancel. Nothing is ever sent automatically; WhatsApp opens with the text prefilled.

**AI generation** — real AI via a secure server function (key stays server-side, never in the browser). Tone options: Friendly, Professional, Firm. Output is always editable. Clear loading state and a friendly fallback to the template message if AI fails.

**Templates** — Friendly, Professional, Firm, Very Firm, Final, End-of-Month, VIP. Template registry carries a `tier` flag so Phase 3 gating attaches without refactoring. No locking in this phase.

**Reminder history** — stored locally per reminder: customer, transaction, timestamp, type, message, status (Prepared / Sent / Cancelled). The app never claims WhatsApp delivered anything; the user marks a reminder as Sent on return.

**Filters** — Due Today, Due This Week, Overdue added to the existing filter row.

**PDF receipts** — Credit Sale Receipt, Payment Receipt, Customer Statement. Include Track Debt logo, business logo/name/phone/address, customer name/phone, receipt reference, dates, description, original amount, amount paid, remaining balance, due date, payment status, generated date, all in ₦ formatting.

**Receipt numbering** — `TD-2026-000001`, sequential, never reused after a deletion.

**Sharing** — Download PDF, native Share, WhatsApp, Print, and Copy Receipt Summary.

**Errors** — friendly messages for PDF failure, WhatsApp not opening, AI failure. Data is never lost on error.

## Phase 3 — Free + Track Debt Pro

**Free stays fully usable**: unlimited customers, transactions, payment terms, overdue tracking, search, filters, WhatsApp reminders, free AI reminders, basic receipts, statements, dashboard.

**Track Debt Pro**: no ads, premium templates, Excel/CSV export, cloud backup, multiple businesses, advanced analytics, future premium AI.

**Upgrade page** — headline, benefit list with icons, pricing pulled from one central config (never hard-coded in components), Free vs Pro comparison table, Restore Purchase.

**Gating** — one reusable gate component. Free users tapping a Pro feature see an explanation with Upgrade to Pro / Maybe Later, never a silently disabled button. Pro features carry a Pro badge.

**Subscription service** — states Free, Pro Active, Pro Expired, Payment Pending, Payment Failed. Expiry re-locks premium features, restores ads, and leaves all local data untouched. Abstraction is ready for Google Play Billing or Paystack later; the frontend never decides a payment succeeded.

**Ads** — AdMob abstraction + centralized config (App ID, banner unit, native unit, test/production mode, Google test IDs during development). Per your answer, ad components render nothing in the web preview; they are wired for native Capacitor/Android. Banner reserved for bottom of non-critical screens, native slot occasional in the customer list. Never during sale/payment recording, customer creation, reminder editing, AI generation, or on receipt screens. Pro users never see ads.

**Analytics abstraction** — event names defined (app opened, customer added, transaction created, payment recorded, reminder prepared/sent, AI reminder generated, receipt generated, upgrade viewed/initiated, subscription activated), no personal data collected, no provider wired yet.

## Technical notes

- Data model: `Txn` gains `dueDate`, `terms`, `reference`; new local stores for reminder history, receipt counter, subscription state. A one-time migration upgrades existing stored records so no data is lost.
- New shared modules: `due-dates.ts`, `reminders.ts` (templates + message builder), `receipts.ts` (PDF via a Worker-safe browser PDF library), `subscription.ts`, `ads.ts`, `analytics.ts`, `pdf` generation client-side.
- AI: a TanStack `createServerFn` calling Lovable AI; `LOVABLE_API_KEY` read inside the handler only.
- The current single-file screen switcher is split into per-screen components under `src/components/` and, where it helps (Settings, About, Upgrade), real routes — navigation behaviour and visuals stay identical.
- PWA: `vite-plugin-pwa` with a network-first navigation strategy and preview-safe registration guards.
- No backend/database: everything stays in local storage.

## Verification before finishing

Overdue calculation, reminder preview/edit, AI generation, WhatsApp handoff, reminder history, all three PDF types, sharing, gating, subscription states, ad suppression for Pro, and that existing customers/transactions survive the upgrade.
