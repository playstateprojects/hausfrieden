# CLAUDE.md

Hausfrieden: a family chores/points app. SvelteKit 3 + Svelte 5 runes + TypeScript, deployed on
Cloudflare Workers with D1 (Drizzle), auth via better-auth, validation via zod. See README.md.

## SvelteKit 3 conventions (differs from SvelteKit 2!)
- No `svelte.config.js` — config is passed to `sveltekit()` in `vite.config.ts`.
- Use `#lib/...` imports **with the `.ts` extension** (e.g. `import { House } from '#lib/logic.ts'`). `$lib` no longer exists.
- `$app/env` (not `$app/environment`), `$app/state` (not `$app/stores`), `refreshAll` (not `invalidateAll`).
- Hook types come from `@sveltejs/kit/hooks`. Use `Response.json()` instead of `json()`.
- Cloudflare bindings: `import { env } from 'cloudflare:workers'` (there is no `platform.env`). Types are in `worker-configuration.d.ts` (`npm run cf-typegen`).
- Anything under a `server/` directory is server-only.
- **No `+page.server.ts` / `+layout.server.ts` / form actions.** The app is a client-rendered SPA (`ssr = false` in `src/routes/+layout.ts`) that reads and writes through JSON endpoints under `src/routes/api`. This is what lets the same code ship as the web app and as the Capacitor app.

## Architecture rules
- All family mutations go through `POST /api/f/[fid]` as one op from the zod union in `src/lib/schemas.ts`. To add a feature: add an op schema → handle it in `src/lib/server/ops.ts` → call `app.send({...})` from the client.
- Every query must be scoped by `family_id`; ops get the family from the URL after `requireMembership`.
- D1 limits: max 100 bound parameters per statement (chunk multi-row inserts); use `db.batch([...])` for atomic multi-statement writes.
- Timestamps in app tables are epoch milliseconds (numbers). "Today" is computed client-side in local time.
- Client state lives in `AppState` (`src/lib/client/app.svelte.ts`), shared via `getApp()` context. The first load is `(app)/+layout.ts` → `GET /api/bootstrap`; after that `AppState.refresh()` re-fetches it (polling, focus, after saves) and replaces the data. A failed refresh keeps what's on screen.
- Always call the API through `api()` from `#lib/client/api.ts` (adds the base URL and bearer token in the native build); use `getJson()` inside `load` functions. The active family id is kept client-side in localStorage (`hf_family`), not in a cookie.
- Auth: web uses better-auth cookies; the native app sends `Authorization: Bearer` (better-auth `bearer` plugin, token in localStorage). CORS for the Capacitor origins is in `hooks.server.ts` / `NATIVE_ORIGINS` in `server/http.ts` — add new origins there and in better-auth `trustedOrigins` (done via the same constant).
- Styles are global in `src/app.css` (carried over from the original artifact); keep the warm/teal look.

## Native apps (Capacitor)
- `npm run build:native` = `vite build --mode native`: adapter-static into `build-native/`, API base from `.env.native` (`VITE_API_BASE`). The plain `npm run build` stays the Cloudflare Worker build. The mode switch picks the adapter, so there is nothing to switch back.
- `npm run cap:ios` / `cap:android` build native, `cap sync`, and open Xcode / Android Studio. After changing web code, re-run one of these (or `npm run cap:sync`) — the app bundles the UI, it does not load it from the web.
- API changes must stay backwards compatible with shipped app versions (old builds keep calling the live API).
- Icons/splash: replace `resources/icon.png`, then `npm run cap:assets`.

## Checks before committing
```bash
npm run check        # svelte-check, must be 0 errors
npm run build
```
Schema change? `npm run db:generate` and commit the migration in `drizzle/`. Remind the human to run `npm run db:migrate:remote` after merge.

## Workflow
Work on a branch and open a PR; Cloudflare Workers Builds posts a preview URL. `main` deploys to production.
