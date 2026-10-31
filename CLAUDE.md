# CLAUDE.md

Hausfrieden: a family chores/points app. SvelteKit 3 + Svelte 5 runes + TypeScript, deployed on
Cloudflare Pages with D1 (Drizzle), auth via better-auth, validation via zod. See README.md.

## SvelteKit 3 conventions (differs from SvelteKit 2!)
- No `svelte.config.js` — config is passed to `sveltekit()` in `vite.config.ts`.
- Use `#lib/...` imports **with the `.ts` extension** (e.g. `import { House } from '#lib/logic.ts'`). `$lib` no longer exists.
- `$app/env` (not `$app/environment`), `$app/state` (not `$app/stores`), `refreshAll` (not `invalidateAll`).
- Hook types come from `@sveltejs/kit/hooks`. Use `Response.json()` instead of `json()`.
- Cloudflare bindings: `import { env } from 'cloudflare:workers'` (there is no `platform.env`). Types are in `worker-configuration.d.ts` (`npm run cf-typegen`).
- Anything under a `server/` directory is server-only.

## Architecture rules
- All family mutations go through `POST /api/f/[fid]` as one op from the zod union in `src/lib/schemas.ts`. To add a feature: add an op schema → handle it in `src/lib/server/ops.ts` → call `app.send({...})` from the client.
- Every query must be scoped by `family_id`; ops get the family from the URL after `requireMembership`.
- D1 limits: max 100 bound parameters per statement (chunk multi-row inserts); use `db.batch([...])` for atomic multi-statement writes.
- Timestamps in app tables are epoch milliseconds (numbers). "Today" is computed client-side in local time.
- Client state lives in `AppState` (`src/lib/client/app.svelte.ts`), shared via `getApp()` context. Server data is replaced on every `invalidate('app:family')`.
- Styles are global in `src/app.css` (carried over from the original artifact); keep the warm/teal look.

## Checks before committing
```bash
npm run check        # svelte-check, must be 0 errors
npm run build
```
Schema change? `npm run db:generate` and commit the migration in `drizzle/`. Remind the human to run `npm run db:migrate:remote` after merge.

## Workflow
Work on a branch and open a PR; Cloudflare Pages posts a preview URL. `main` deploys to production.
