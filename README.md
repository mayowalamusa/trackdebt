# Track Debt

Track Debt is a simple customer credit-sales and debt-tracking app for small businesses.

It helps business owners record credit sales and payments, see who owes them, monitor due dates, prepare payment reminders, generate receipts and keep customer records organised.

## What Track Debt does

- **Customer management** — keep customer names, phone numbers and notes in one place.
- **Credit-sales tracking** — record sales made on credit and the payments received against them.
- **Outstanding balances** — quickly see what each customer still owes.
- **Due dates** — attach payment terms and identify upcoming or overdue balances.
- **Payment reminders** — prepare and send reminders through WhatsApp.
- **Receipts and statements** — generate customer receipts and statements, including PDF receipts on supported plans.
- **Notifications** — receive due-date and business-record reminders.
- **Backup and restore** — export and restore local business records.
- **Visitor/local mode** — use the app without creating an account.
- **Registered accounts** — move local records to cloud storage and access supported data across devices.
- **Multi-currency support** — manage business records in supported African currencies without hard-coding the ledger to one currency.

### Supported currencies

The current operating/display currencies are:

| Code | Currency |
|---|---|
| NGN | Nigerian Naira |
| GHS | Ghanaian Cedi |
| KES | Kenyan Shilling |
| TZS | Tanzanian Shilling |
| UGX | Ugandan Shilling |
| ZMW | Zambian Kwacha |
| RWF | Rwandan Franc |

The default currency is NGN. Users can change the business currency from the Business Profile settings. When a currency is changed, Track Debt uses an available daily reference exchange rate and keeps transaction source information to reduce repeated-conversion drift.

## Data model

Track Debt has two storage modes:

### Visitor / local mode

A visitor can use Track Debt without an account. Business records are stored locally on the device.

### Registered / cloud mode

A registered user can move local business records into their Track Debt account. Once cloud storage is activated, the registered account becomes the source of truth for supported synced records.

When local records exist during registration, Track Debt asks whether the user wants to move them to the cloud or wipe the local records instead.

## Plans

Track Debt has a Free plan and paid features are being introduced progressively.

Track Debt Plus is planned as a monthly subscription with features such as AI reminders, premium templates, voice entry, PDF receipts, no ads and additional business tools.

The current Plus billing configuration uses NGN because payment processing is configured around Paystack. The ledger's operating currency is separate from subscription billing currency.

## Privacy and data

Track Debt may process account information, business profile details, customer information, transaction records, reminders, notification preferences and subscription information depending on the features a user chooses.

Visitor records remain local unless the user chooses to create an account and move them to cloud storage.

For the in-app privacy policy, open **Settings → Privacy Policy**.

For the terms of use, open **Settings → Terms of Use**.

## Exchange rates

Currency conversion uses the Frankfurter exchange-rate API. Track Debt requests currency-pair reference rates server-side and caches them before using them for conversion.

Exchange-rate figures are provided for record-management convenience and should not be treated as guaranteed bank, settlement, tax or accounting rates.

## Technology

- React + TypeScript
- TanStack Start
- TanStack Router
- Tailwind CSS
- Supabase for authentication and cloud data
- Paystack for subscription/payment processing
- Frankfurter for reference exchange rates
- Capacitor-related tooling for supported mobile builds

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the web application:

```bash
npm run build
```

If you are working on the mobile build configuration:

```bash
npm run build:capacitor
```

## Project structure

Important areas of the project include:

```text
src/
  components/       Shared UI components
  lib/              Ledger, storage, auth, currency and service logic
  routes/           Application screens and API routes
  assets/           Application assets
public/             Manifest, icons, service worker and static files
supabase/
  migrations/       Database migrations
```

## Currency architecture

Currency should remain a business-level setting rather than a Paystack billing setting.

Transactions carry:

- the current operating/display currency;
- the original transaction amount;
- the original transaction currency.

This allows the app to recalculate display amounts from the original source information instead of repeatedly converting an already-converted amount.

## Important product principles

1. **Do not assume every user is in Nigeria.**
2. **Do not hard-code Naira symbols into ledger screens, receipts, reminders or transaction forms.**
3. **Keep subscription billing currency separate from business-record currency.**
4. **Preserve transaction source currency information when converting.**
5. **Do not silently wipe local records during account registration.**
6. **Do not claim a transaction or payment has been delivered or collected unless the app has evidence for it.**
7. **Keep customer data private and only request information needed for the feature being used.**

## Developer

Track Debt is developed by **Izick Creations Media**.

Support: **mytrackdebt@gmail.com**

## License

The project does not currently declare an open-source license. Unless a license is added to this repository, source-code reuse is not granted beyond rights provided by applicable law.
