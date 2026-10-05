<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Plan limits live only in `PLAN_LIMITS` (src/lib/app-config.ts) and flow through `getEntitlements`; never hard-code limits in components — one source of truth for UI and tests.
- Cloud sync only upserts; deletions go through explicit `deleteCloudCustomer`/`deleteCloudTransaction` — a stale or partial local list must never wipe cloud rows.
- The Free active-customer limit is also enforced by a DB trigger in the `private` schema that recognises paid subscriptions and claimed promo redemptions — client checks alone are bypassable.
