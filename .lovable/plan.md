# Switch Paystack from test mode to live

The user has updated the Paystack secrets to live values. Goal: confirm the live configuration actually works, then publish so real customers can be charged.

## Steps

1. **Verify the live secret key** — call Paystack's API with the stored `PAYSTACK_SECRET_KEY` (e.g. fetch the plan or list banks). A test key against live-only data, or an invalid key, returns an auth error. If it fails, ask the user to re-check the key they pasted.
2. **Verify the live plan code** — fetch plan `PLN_9httukvyf3zzdnm` (the stored `PAYSTACK_PLUS_PLAN_CODE`) from Paystack. Plans created in test mode do not exist in live mode, so if this returns "plan not found", the user must recreate the ₦1,000/month plan in Paystack's live mode and give me the new plan code to save.
3. **Fix build errors** — the preview currently has build errors from the previous session; resolve them so the app builds cleanly.
4. **Run checks** — `bunx tsgo --noEmit` and `bunx vitest run` (52 tests) must pass.
5. **Publish** — deploy to https://trackdebt.lovable.app so the live keys take effect on the published site.

## What the user must do in their Paystack dashboard (outside this app)

- Set the **live** webhook URL to `https://trackdebt.lovable.app/api/paystack/webhook` (Settings → API Keys & Webhooks). Without this, successful payments won't activate Plus automatically.

## Technical notes

- Verification calls are read-only GETs to `https://api.paystack.co/plan/PLN_9httukvyf3zzdnm` using the stored secret; no charges are made.
- No code changes are expected unless verification reveals a mismatch (e.g. new live plan code to save via secrets).
- The platform fee for customer collections stays at the configured `PAYSTACK_PLATFORM_FEE_PERCENT` (default 1%).
