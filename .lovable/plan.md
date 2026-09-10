# Fix the blank published site and speed it up

## What's wrong

The live site at trackdebt.lovable.app returns a page, but it is the leftover
mobile/static starter page: it contains an empty container and a script tag pointing at a
development-only file that doesn't exist in the published build. Nothing can ever render,
so visitors see plain white. The editor preview works because the development server can
serve that file.

## Fix

1. Delete the leftover static starter page (`index.html`) at the project root so the
   published site serves the real server-rendered app.
2. Simplify the app startup file (`src/client.tsx`) to only the server-rendered path — the
   static/Android branch is dead code now that the mobile build is gone.
3. Remove the stray duplicate copies of app files sitting loose in the project root
   (`__root.tsx`, `index.tsx`, `styles.css`, `ads.ts`, `receipts.ts`, `reminders.ts`,
   `reminders.functions.ts`, `subscription.ts`, `due-dates.ts`, `app-config.ts`,
   `use-ledger-storage.ts`, plus the old patch file and `android.artifacts/`). They are not
   used by the app and only add confusion.
4. Rebuild and confirm the produced page contains the real app markup, then republish and
   check the live URL.

## Make it load faster

- Move the Google Fonts stylesheet off the critical path so text paints immediately
  instead of waiting on an external stylesheet round trip.
- Drop the unused chart library (`recharts`) and the unused PWA plugin package, which
  shrinks the download the browser has to parse.
- Confirm the PDF/receipt libraries stay lazily loaded (they already are) so they only
  download when someone actually creates a receipt.
- Preload the main app icon/logo used on first screen and keep everything else lazy.
- Add per-page titles and descriptions for the main screen so search and link previews are
  correct (currently only the shared root metadata exists).

## Technical notes

- Root `index.html` in a TanStack Start project shadows the SSR shell in the published
  output; removing it restores `src/routes/__root.tsx` as the document shell.
- `src/client.tsx` keeps only the `hydrateRoot(document, <StartClient />)` path.
- Optional follow-up (not in this change): upgrading `@lovable.dev/vite-tanstack-config`
  from 2.13.1 to 2.20.0+ would allow prerendering the home route to static HTML for an
  even faster first paint. Can be done once the site is confirmed working.
