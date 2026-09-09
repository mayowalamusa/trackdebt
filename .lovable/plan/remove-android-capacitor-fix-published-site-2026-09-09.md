# Remove Android/Capacitor, fix published site

## Goal
Make Track Debt a web-only app and get the published link (trackdebt.lovable.app) working again instead of showing "Not found".

## Root cause of the broken published site
The `build` script in package.json runs the GitHub Pages static build (`vite.web.config.ts`), which hardcodes the base path `/trackdebt/` and outputs to `dist/web`. When the publish system serves that output at the root of trackdebt.lovable.app, assets and routes don't resolve — hence "Not found". The editor preview works because it uses the dev server, not that build script.

## Changes

### 1. Remove Android / Capacitor
- Delete the `android/` folder, `capacitor/` folder, `capacitor.config.ts`, `capacitor.config.json`, `vite.client.config.ts`, and `src/lib/reminders.functions.capacitor.ts`.
- Remove `@capacitor/android`, `@capacitor/cli`, `@capacitor/core`, `@capacitor/local-notifications` from package.json dependencies.
- Remove the `build:capacitor` script.
- Clean up remaining Capacitor references in code (e.g. `src/client.tsx` static-build branch, `src/lib/notifications.ts` if it imports Capacitor plugins, `.agent.deploy.md` notes can stay as docs or be trimmed).
- Remove `.github/workflows/pages.yml`, `vite.web.config.ts`, and `scripts/prepare-pages.mjs` — the GitHub Pages build is no longer needed and is what breaks publishing.

### 2. Fix build scripts for Lovable publishing
- Set `build` to the standard TanStack Start build (`vite build`), matching `build:start`.
- Verify `npm run build` completes and produces server output.

### 3. Verify and publish
- Confirm the preview still loads and core flows work (customers, transactions, reminders).
- Republish the site and confirm trackdebt.lovable.app serves the app instead of "Not found".

## Technical details
- Web app keeps using the existing TanStack Start SSR setup (`vite.config.ts`, `src/server.ts`) — no product/UI changes.
- The AI reminder feature continues to work via the real server function (`src/lib/reminders.functions.ts`); only the fetch-based Capacitor stand-in is removed.
- Local notifications previously targeted Android; web-only will rely on existing in-app UI (any Capacitor-only notification imports get removed with a graceful fallback).
