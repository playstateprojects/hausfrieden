# Hausfrieden

Everyday jobs, points and treats for the whole family. A SvelteKit port of the original
single-file Claude artifact, now with real accounts and support for many families.

**Stack:** SvelteKit 3 (Svelte 5 runes, TypeScript) · Cloudflare Workers + D1 · Drizzle ORM ·
better-auth (email + password) · zod

## How it fits together

| Concept | Table | Notes |
| --- | --- | --- |
| Login | `user`, `session`, `account`, `verification` | better-auth's tables |
| Household | `families` | has an `invite_code` for `/join/<code>` |
| Person in a household | `members` | `user_id` links a member to a login; kids can be members without one and are picked on a shared phone |
| Rooms, tasks, treats | `rooms`, `tasks`, `rewards` | scoped by `family_id` |
| History | `log_entries`, `redemptions` | points balance = all log points − all redemptions |

- **Reads:** `src/routes/(app)/+layout.server.ts` loads the whole family state (`depends('app:family')`).
- **Writes:** every mutation is one zod-validated op POSTed to `/api/f/[familyId]`
  (`src/lib/schemas.ts` → `op`, handled in `src/lib/server/ops.ts`). The client applies
  ticks optimistically, then re-syncs.
- **Sync between family members:** the client polls every 20 s and on tab focus.
- **Scheduling / points logic:** `src/lib/logic.ts` (pure, ported 1:1 from the artifact).
- **Passwords** are hashed with WebCrypto PBKDF2 (`src/lib/server/password.ts`), because
  better-auth's default scrypt can exceed the Workers free-plan CPU limit.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars          # then put a real secret in it: openssl rand -hex 32
npm run db:migrate:local                # creates the local D1 database under .wrangler/
npm run dev                             # vite dev server with D1 bindings
# or, closest to production:
npm run preview                         # builds and runs in the real Workers runtime on :8788
```

### Changing the database

1. Edit `src/lib/server/db/schema.ts`
2. `npm run db:generate` — writes a new SQL migration into `drizzle/`
3. `npm run db:migrate:local` to try it, commit the migration
4. After merging, run `npm run db:migrate:remote` (migrations are **not** applied by the Workers build)

If you change `wrangler.toml` bindings, run `npm run cf-typegen`.

## Deploying to Cloudflare Workers (one-time setup)

1. `npx wrangler d1 create hausfrieden` and paste the `database_id` into `wrangler.toml`.
2. `npm run db:migrate:remote`
3. Cloudflare dashboard → Workers & Pages → Create → Import a repository → this repo.
   - Build command: `npm run build` · Deploy command: `npx wrangler deploy`
   - Non-production branch command: `npx wrangler versions upload` (gives preview URLs)
   - The D1 binding, assets and compatibility flags come from `wrangler.toml`.
4. Settings → Variables and Secrets → add `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`.
5. Push to `main` → production deploy. Any other branch / PR → preview URL.

## Google Calendar sync (optional)

Grown-ups with their own login can connect a Google Calendar from their profile sheet (tap your
name at the top). Family events are then pushed one way into that calendar
(`src/lib/server/google.ts`, table `calendar_links`). Without the two variables below the option
simply doesn't show.

1. [Google Cloud console](https://console.cloud.google.com/) → new project → enable the **Google Calendar API**.
2. OAuth consent screen: add the scopes `.../auth/calendar.events` and
   `.../auth/calendar.calendarlist.readonly`. While the app is in "Testing", add each adult as a
   test user (and note that Google expires test-mode refresh tokens after 7 days — publish the app
   to avoid reconnecting weekly).
3. Credentials → Create OAuth client ID → **Web application**. Authorised redirect URIs:
   `https://<your-domain>/api/google/callback` and `http://localhost:5173/api/google/callback`.
   The native apps use the same client (the consent screen opens in the system browser).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets and in `.dev.vars`.

Preview URLs can't complete the flow unless their callback URL is registered too.

## Working on it with Claude

See `CLAUDE.md`. Suggested flow: ask Claude to make a change on a branch and open a PR,
check the preview link on the PR, merge to deploy.
