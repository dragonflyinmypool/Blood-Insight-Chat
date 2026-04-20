---
name: local-dev-setup
description: Start, stop, reset, and troubleshoot the local dev stack — Supabase (DB + Storage + Edge Functions) plus the Next.js app on host. Use when the user says "run the app", "start dev", "reset the database", "regenerate types", "restart supabase", "run migrations", or hits a dev-env issue.
---

# Local dev setup

Two pieces:

1. **Supabase stack** — `supabase start`. Uses Docker under the hood (Postgres, Studio, Storage, Edge Functions, Auth, Realtime, Mailpit).
2. **Next.js app** — `pnpm dev` on the host. No containers.

The app reaches Supabase at `http://127.0.0.1:54321` — set in `.env`.

Edge functions run in Supabase's Docker containers, so when they need to reach host-only services like LM Studio they use `host.docker.internal`. The Next.js app runs directly on the host, so it uses `127.0.0.1`. Don't mix these up.

## Full startup (cold)

### Prerequisites

- **Docker Desktop** — running. Supabase uses it under the hood.
- **Node 20+** and **pnpm** (`pnpm --version`).
- **Supabase CLI** (`supabase --version`).
  - macOS/Linux: `brew install supabase/tap/supabase`
  - Windows: Scoop (`scoop install supabase`) or download the binary from <https://github.com/supabase/cli/releases> (the `_windows_amd64.tar.gz` asset — extract to a folder on PATH). **Do not** `npm i -g supabase` — the npm package refuses to install globally.
- **LM Studio** (optional, for local AI): start its server on `:1234` with an instruct model loaded. Otherwise put a real `OPENAI_API_KEY` in `supabase/functions/.env`.

### First time only

```bash
pnpm install

# App env (URL + anon key). Defaults in .env.example work for local Supabase.
cp .env.example .env

# Edge function secrets (OpenAI). Create this file — it's gitignored.
cat > supabase/functions/.env <<'EOF'
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
AI_MODEL=qwen2.5-14b-instruct-1m
EOF
```

### Every time

```bash
supabase start             # ~10s once images are cached; first run pulls from public.ecr.aws
pnpm dev                   # :3000 with Turbopack, ready in ~1s
```

Verify:

- `http://localhost:3000` → dashboard
- `http://127.0.0.1:54323` → Supabase Studio (Postgres GUI)
- `http://127.0.0.1:54321/rest/v1/blood_tests?apikey=<anon>` → PostgREST, returns `[]`

Edge functions are served alongside the Supabase stack at `http://127.0.0.1:54321/functions/v1/<name>`. They reload automatically when their source changes.

## Shut down

```bash
# Ctrl+C the dev server
supabase stop              # stop all Supabase containers (data persists)
```

For a clean slate:

```bash
supabase stop --no-backup  # discard the Supabase Postgres volume (DESTROYS DATA)
rm -rf .next node_modules  # if you also want a clean Next.js build cache
```

## Working with auth

- **Sign up a test user (local, no email needed):**
  ```bash
  ANON=$(supabase status --output json | jq -r .ANON_KEY)
  curl -sS -X POST "http://127.0.0.1:54321/auth/v1/signup" \
    -H "apikey: $ANON" -H "content-type: application/json" \
    -d '{"email":"test@local.dev","password":"testtest"}'
  ```
  Local dev has `[auth.email] enable_confirmations = false`, so the user is active immediately.
- **List / delete users via Studio:** http://127.0.0.1:54323 → Authentication → Users.
- **Delete a user via admin API:**
  ```bash
  SERVICE=$(supabase status --output json | jq -r .SERVICE_ROLE_KEY)
  curl -X DELETE "http://127.0.0.1:54321/auth/v1/admin/users/<uuid>" \
    -H "apikey: $SERVICE" -H "authorization: Bearer $SERVICE"
  ```
- **Reset password links + confirmation emails** are captured by Mailpit at http://127.0.0.1:54324. Click through them there instead of a real inbox.
- **Toggle email confirmation for prod parity:** edit `supabase/config.toml` → `[auth.email] enable_confirmations = true`, then `supabase stop && supabase start`.
- **Site URL for redirects** (`site_url` and `additional_redirect_urls` in `config.toml`) must include every host the app is served from. After changes, restart Supabase.
- **Middleware onboarding gate**: a new user whose `profiles.onboarded` is still `false` will be pushed to `/onboarding` by [`lib/supabase/middleware.ts`](lib/supabase/middleware.ts). That row is created by the `on_auth_user_created` trigger in the auth migration.

## Working with the database

Migrations live in `supabase/migrations/*.sql` and are applied automatically on `supabase start` / `supabase db reset`.

- Add a new migration:
  ```bash
  supabase migration new <name>
  # edit supabase/migrations/<timestamp>_<name>.sql
  supabase db reset            # re-runs all migrations on a fresh DB (local only)
  ```
- Inspect / edit data by hand: open Studio at http://127.0.0.1:54323.
- Connect psql directly: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

The app does NOT use Drizzle or a separate ORM. It reads/writes via the Supabase JS client ([lib/supabase/client.ts](lib/supabase/client.ts) / [lib/supabase/server.ts](lib/supabase/server.ts)) using PostgREST auto-generated endpoints. Types live in [lib/supabase/types.ts](lib/supabase/types.ts) and are auto-generated from the live schema.

Regenerate after every schema change:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

**Two gotchas with that file** (the CLI output on Windows isn't fully clean):

1. The first line may contain a `Connecting to db 5432` status message — delete it so the file starts with `export type Json =`.
2. The generator may omit the `__InternalSupabase` marker that `@supabase/supabase-js` 2.100+ expects. If `pnpm typecheck` complains that tables resolve to `never`, add this at the top of the `Database` type:
   ```ts
   export type Database = {
     __InternalSupabase: { PostgrestVersion: "12" }
     // ...rest of generator output
   }
   ```

## Working with edge functions

Functions live in `supabase/functions/<name>/index.ts`. They are Deno (not Node) — use `npm:` or `jsr:` specifiers for imports.

- `supabase start` automatically serves all functions at `http://127.0.0.1:54321/functions/v1/<name>`. File changes hot-reload.
- Secrets (OpenAI key, model name, etc.) go in `supabase/functions/.env` — loaded automatically by `supabase start`.
- Auto-injected env vars available in every function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Test a function from the command line:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/chat-send \
  -H "apikey: $(supabase status --output json | jq -r .ANON_KEY)" \
  -H "authorization: Bearer $(supabase status --output json | jq -r .ANON_KEY)" \
  -H "content-type: application/json" \
  -d '{"conversationId": 1, "content": "hello"}'
```

Newly added functions require `supabase stop && supabase start` — the edge-runtime container reads the function list at startup.

## Environment variables

| Location | Variables | Purpose |
|---|---|---|
| `.env` (host; template in `.env.example`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Read by Next.js on host and by the browser |
| `supabase/functions/.env` | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `AI_MODEL` | Read by edge functions only |

The anon and service-role keys for local Supabase are deterministic — `supabase status` prints them. Never commit the service-role key to a remote repo; the local one is public and safe to paste into example files.

## Adding a feature

Quick cookbook for typical tasks a new contributor will hit:

**Add a page to the authenticated app.** Create `app/(app)/<path>/page.tsx`. It will inherit the `(app)` group layout (auth check + sidebar). Server Component by default — use `createClient()` from [lib/supabase/server.ts](lib/supabase/server.ts) to query Supabase. RLS scopes rows to the current user automatically.

**Add a client-side interaction** (form, button with state, dropdown). Create a sibling component with `"use client"` at the top and import it into the Server Component page. Use `createClient()` from [lib/supabase/client.ts](lib/supabase/client.ts) for mutations.

**Add a column / table.**
1. `supabase migration new <name>`
2. Edit the generated SQL file. Every new table should `enable row level security` and have policies scoped to `auth.uid()` (see the existing auth migration for the pattern). Rows owned by a user should have `user_id uuid not null default auth.uid() references auth.users on delete cascade`.
3. `supabase db reset` to reapply migrations locally.
4. `supabase gen types typescript --local > lib/supabase/types.ts`, then fix the two gotchas above.
5. Restart `pnpm dev` so TypeScript picks up the new types.

**Add an edge function.** `supabase functions new <name>`, edit `supabase/functions/<name>/index.ts`. Use `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization")! } } })` so RLS applies inside Deno. Then `supabase stop && supabase start` (new functions aren't picked up by hot reload, only existing ones). Call from the client with `supabase.functions.invoke("<name>", { body: {...} })` — the browser client attaches the user's JWT automatically.

**Add a page outside auth.** Put it under `app/(auth)/` (styled with the centered card layout) or at `app/<path>/` and update [lib/supabase/middleware.ts](lib/supabase/middleware.ts) `PUBLIC_PREFIXES` so the middleware lets unauthenticated traffic through.

**Change the dashboard sidebar.** Edit `navItems` in [components/app-shell.tsx](components/app-shell.tsx).

## Common issues

**Edge function 401 on every call.** Your `NEXT_PUBLIC_SUPABASE_ANON_KEY` is stale (keys regenerate if you run `supabase stop --no-backup` then `start`). Run `supabase status`, copy the new anon key, update `.env`, then restart `pnpm dev` to pick up the new env. If the key is correct, check that the client is sending `Authorization: Bearer <user access token>`, not just the anon key — our edge functions require an authenticated user.

**Stuck in a `/login` ↔ `/` redirect loop.** Usually means the session cookie is set but `auth.getUser()` is rejecting it (often because the local JWT secret changed since the cookie was issued). Clear cookies for `localhost:3000` and sign in again.

**Logged in but everything says "no data".** RLS is doing its job — you're looking at another user's data (or the user_id default didn't apply). Check `select auth.uid()` in the SQL editor while hitting the app and confirm rows have matching `user_id`.

**Upload fails with `OPENAI_API_KEY must be set`.** The edge function can't see its secrets. Check `supabase/functions/.env` exists with the variable set, then `supabase stop && supabase start`.

**LM Studio unreachable from edge function.** Edge functions run in Supabase's Docker containers, so they reach the host via `host.docker.internal`. Use `OPENAI_BASE_URL=http://host.docker.internal:1234/v1` (not `localhost`). Confirm LM Studio's server is started (Developer tab → Start).

**App can't reach Supabase.** Next.js runs on the host, so it should use `http://127.0.0.1:54321` in `.env`. Don't use `host.docker.internal` here — that's only for containers.

**`supabase start` fails to pull images.** The CLI pulls from `public.ecr.aws/supabase/*`, not Docker Hub, so most corporate MITM setups don't block it. If pulls still fail, check `docker system info` for proxy config.

**New edge function returns 404.** The edge-runtime container only picks up functions that existed at `supabase start` time. Run `supabase stop && supabase start` after `supabase functions new`.

**Stale types after schema change.** Regenerate: `supabase gen types typescript --local > lib/supabase/types.ts`, then TypeScript errors across pages will surface the rows you need to update.

**Page shows "No blood tests yet" but the DB has rows.** The table query is scoped to the anon role and RLS is on. Confirm the seed policies exist: `select * from pg_policies where tablename = 'blood_tests'`. If missing, run `supabase db reset` to re-apply migrations.

**Port 3000 already in use.** Another process has it. On Windows: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess` to find it.

## Ports (reference)

| Port | Service |
|---|---|
| 3000  | Next.js dev server (host) |
| 54321 | Supabase API gateway (REST, Auth, Storage, Functions) |
| 54322 | Supabase Postgres |
| 54323 | Supabase Studio |
| 54324 | Mailpit (email capture during local dev) |
| 1234  | LM Studio (on host, optional — serves OpenAI-compatible API) |
