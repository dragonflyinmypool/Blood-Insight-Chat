# Blood Insight Chat

Web app to upload blood test PDFs, automatically extract biomarkers, track them over time, and chat with an AI about your results.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Next.js 15 (App Router) — `pnpm dev` on host, :3000        │    │
│  │    • Server Components read data directly from Supabase     │    │
│  │      via @supabase/ssr                                      │    │
│  │    • Client Components mutate via @supabase/supabase-js     │    │
│  │    • Uploads + chat hit Edge Functions (not Next.js API)    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             │  127.0.0.1:54321
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase (managed by `supabase start` — Docker under the hood)     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Postgres    │  │  Storage     │  │  Edge Functions (Deno)     │ │
│  │  + PostgREST │  │  (PDF blobs) │  │  • upload-blood-test       │ │
│  │  + RLS       │  │              │  │  • chat-send (SSE stream)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┬─────────────┘ │
│                                                     │               │
│                        Studio (:54323)              │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                     │
                                                     ▼  host.docker.internal:1234
                                          ┌─────────────────────────┐
                                          │  LM Studio (host)       │
                                          │  OpenAI-compatible API  │
                                          └─────────────────────────┘
```

There is **no separate backend server**. Next.js is the frontend, PostgREST is the CRUD API (auto-generated from the schema), and two Supabase Edge Functions (Deno) handle the AI work. Drizzle, Express, and custom Next.js route handlers are all gone.

**Auth**: Supabase email/password. Middleware enforces that every page under `app/(app)/*` requires a session; auth pages in `app/(auth)/*` redirect signed-in users back. Every row in every domain table is scoped to the owner via `user_id = auth.uid()` RLS policies. Storage files live under `{user_id}/{hash}.pdf` and are similarly scoped.

## Stack

| Layer | Tech |
|---|---|
| UI | Next.js 15 App Router, React 19, TypeScript 5.7 |
| Styling | Tailwind v4, shadcn/ui (new-york), lucide-react, sonner |
| Data fetching | `@supabase/ssr` (Server Components), `@supabase/supabase-js` (browser) |
| Charts | Recharts |
| Database | Supabase Postgres 17 + PostgREST + Row Level Security |
| Storage | Supabase Storage bucket (`blood-tests`) for raw PDFs |
| AI | Supabase Edge Functions (Deno 2) → OpenAI SDK → LM Studio (local) or OpenAI (remote) |
| PDF parsing | `unpdf` (edge-runtime-compatible) |
| Local infra | Supabase CLI |

## Running locally

Prerequisites:

- **Node 20+** and **pnpm** — `pnpm --version` should work
- **Docker Desktop** — Supabase CLI uses Docker under the hood
- **Supabase CLI** — `supabase --version` should work. Install from <https://supabase.com/docs/guides/local-development/cli/getting-started>
- **LM Studio** (optional) — only if you want local AI. Otherwise set real OpenAI creds in `supabase/functions/.env`.

First time:

```bash
pnpm install                 # install Next.js deps
cp .env.example .env         # Next.js env vars (anon key + URL)
```

Every time:

```bash
supabase start               # Postgres, Storage, Edge Functions, Studio on :54321 / :54323
pnpm dev                     # Next.js dev on :3000
```

Open:

- **App** — http://localhost:3000
- **Supabase Studio** (DB GUI) — http://127.0.0.1:54323
- **Mailpit** (captured dev emails) — http://127.0.0.1:54324

To stop: `Ctrl+C` the dev server, then `supabase stop`.

### LM Studio wiring

1. Open LM Studio → Developer → Start Server (default port `1234`)
2. Load an instruct model (Qwen 2.5 14B Instruct works well for blood-test extraction)
3. Set the loaded model's ID in `supabase/functions/.env`:

   ```
   OPENAI_API_KEY=lm-studio
   OPENAI_BASE_URL=http://host.docker.internal:1234/v1
   AI_MODEL=qwen2.5-14b-instruct-1m
   ```

   The edge functions run in Supabase's Docker containers, so they reach the host via `host.docker.internal`. The Next.js app runs on the host directly, so it uses `127.0.0.1:54321` to reach Supabase.

4. Restart Supabase to pick up edge function env changes: `supabase stop && supabase start`

### Using real OpenAI instead

Edit `supabase/functions/.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Then `supabase stop && supabase start`.

## Project structure

```
.
├── middleware.ts                     # Session refresh + route protection + onboarding gate
│
├── app/                              # Next.js App Router
│   ├── layout.tsx, providers.tsx     # Root (theme + toaster)
│   ├── globals.css                   # Tailwind v4 + CSS vars (teal theme)
│   │
│   ├── (app)/                        # Protected group — requires auth + onboarding
│   │   ├── layout.tsx                # Fetches user + profile, mounts AppShell
│   │   ├── page.tsx                  # Dashboard
│   │   ├── tests/                    # Tests list + detail
│   │   ├── markers/                  # Marker history chart
│   │   └── chat/                     # Conversation list + thread
│   │
│   ├── (auth)/                       # Public auth pages
│   │   ├── layout.tsx                # Centered card layout
│   │   ├── login/                    # Sign-in form
│   │   ├── signup/                   # Create-account form
│   │   ├── forgot-password/          # Send reset email
│   │   └── reset-password/           # Complete password reset
│   │
│   ├── onboarding/                   # First-time profile setup (display name → onboarded=true)
│   │
│   └── auth/                         # Route handlers (no UI)
│       ├── callback/route.ts         # PKCE / OAuth code exchange
│       ├── confirm/route.ts          # OTP / email verification
│       └── signout/route.ts          # POST → sign out + redirect
│
├── components/
│   ├── app-shell.tsx                 # Sidebar + mobile nav + user menu
│   ├── user-menu.tsx                 # Avatar + sign-out dropdown
│   ├── upload-dialog.tsx             # PDF picker → edge function
│   └── ui/                           # shadcn components
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client (createBrowserClient)
│   │   ├── server.ts                 # Server Component client (cookies-aware)
│   │   ├── middleware.ts             # Session refresh + redirect rules
│   │   └── types.ts                  # Hand-maintained Database type (incl. profiles)
│   └── utils.ts                      # cn() helper
│
├── supabase/                         # Managed by Supabase CLI
│   ├── config.toml                   # Functions, ports, auth settings
│   ├── migrations/                   # Tables, RLS, RPCs, storage, auth trigger
│   └── functions/
│       ├── _shared/cors.ts
│       ├── upload-blood-test/        # PDF extract + OpenAI + insert (user JWT)
│       └── chat-send/                # SSE chat streaming (user JWT)
│
├── .env / .env.example               # Next.js runtime env (anon key + URL)
└── .claude/skills/local-dev-setup/   # Skill that documents dev workflow
```

## Database

Schema lives in `supabase/migrations/*.sql`. Applied automatically on `supabase start` / `supabase db reset`.

| Table | Purpose |
|---|---|
| `profiles` | Per-user display name + `onboarded` flag. Auto-created on signup by the `on_auth_user_created` trigger. |
| `blood_tests` | Test metadata + SHA256 content hash (dedup is scoped per user). `user_id` defaults to `auth.uid()` on insert. |
| `blood_test_results` | Extracted markers (value, unit, range, status). Ownership inherited via FK to `blood_tests`. |
| `chat_conversations` | Title + optional `blood_test_id` for context. `user_id` defaults to `auth.uid()` on insert. |
| `chat_messages` | User + assistant turns. Ownership inherited via FK to `chat_conversations`. |

Plus:

- **Storage bucket** `blood-tests` — raw PDF blobs under `{user_id}/{hash}.pdf` with RLS enforcing the path prefix
- **RPC** `blood_test_summary()` — dashboard stats (respects RLS since `security invoker`)
- **RPC** `marker_list()` — distinct markers ordered by usage (respects RLS)

**RLS** is on for every table. Policies scope all reads/writes to `auth.uid() = user_id` (or to ownership of the parent row via FK). The `anon` role sees nothing; only `authenticated` users can read or mutate.

### Migration workflow

```bash
supabase migration new <slug>           # creates a new timestamped .sql file
# edit supabase/migrations/<timestamp>_<slug>.sql
supabase db reset                       # re-runs all migrations on a fresh local DB
```

Don't forget to update `lib/supabase/types.ts` to match, or regenerate it:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

## Auth

Email + password, handled entirely by Supabase Auth. The app never stores passwords.

### User flow

1. **Signup** (`/signup`) — `supabase.auth.signUp({ email, password })`. In local dev email confirmation is off (see `supabase/config.toml → [auth.email] enable_confirmations`), so users land in a session immediately and are bounced to `/onboarding`. In prod, flip that flag on and users will receive a confirmation email; the link hits `/auth/callback` which exchanges the code for a session.
2. **Onboarding** (`/onboarding`) — user picks a display name. Form updates `profiles.onboarded = true`. Middleware stops routing them here afterward.
3. **Dashboard + app** (`/`, `/tests`, `/markers`, `/chat`) — all under `app/(app)/*`. The group layout fetches the current user + profile server-side; if either is missing, redirect to `/login` or `/onboarding`.
4. **Sign out** — `POST /auth/signout` clears cookies and sends the user to `/login`.
5. **Forgot password** (`/forgot-password`) — sends a reset email via Supabase. Link lands on `/reset-password` with a recovery session where `updateUser({ password })` completes the change.

### Under the hood

- **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`) runs on every request. It refreshes the session cookie, redirects unauthenticated users to `/login`, redirects authenticated users away from `/login` and `/signup`, and forces anyone who hasn't finished onboarding onto `/onboarding`.
- **Server Components** use `lib/supabase/server.ts` (`createServerClient` wired to Next's cookie store). Any query they issue runs under the user's JWT and is filtered by RLS — there is no manual "where user_id = ..." in app code.
- **Client Components** use `lib/supabase/client.ts` (`createBrowserClient`). Session lives in cookies managed by `@supabase/ssr` so refreshes just work.
- **Edge Functions** expect the user's access token in `Authorization: Bearer <token>` and build a Supabase client from it, so RLS still applies inside Deno. Writes automatically receive `user_id = auth.uid()` via the column default.

### Config that matters

`supabase/config.toml` → `[auth]`:

- `site_url = "http://localhost:3000"` — where Supabase redirects after email links
- `additional_redirect_urls = [..., "http://localhost:3000/auth/callback", ...]`
- `enable_signup = true`
- `[auth.email] enable_confirmations = false` — **off for local dev**, turn on in prod
- `minimum_password_length = 8`

Changing any of these requires `supabase stop && supabase start`.

## Edge functions

Both live in `supabase/functions/<name>/index.ts`. They run in Deno (not Node), use `npm:` / `jsr:` imports, and hot-reload on save.

| Function | URL | Responsibility |
|---|---|---|
| `upload-blood-test` | `POST /functions/v1/upload-blood-test` | Parse PDF with `unpdf`, ask OpenAI to extract markers in JSON mode, insert rows, stash the raw PDF in Storage under `{user_id}/{hash}.pdf`. Requires user JWT — RLS enforces ownership. |
| `chat-send` | `POST /functions/v1/chat-send` | Build system prompt (with blood-test context if the conversation is linked), stream OpenAI response back as SSE, save full message on completion. Requires user JWT. |

Secrets for these (OpenAI key, base URL, model) live in `supabase/functions/.env`, loaded by `supabase start`. Auto-injected inside every function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The functions themselves use the user's JWT (not the service role), so RLS is enforced inside the function — a user cannot insert a blood test into someone else's account even if they know the ID.

## Commands

```bash
pnpm dev          # Next.js dev server (:3000)
pnpm build        # production build
pnpm start        # run production server
pnpm typecheck    # tsc --noEmit

supabase start    # bring up the whole Supabase stack
supabase stop     # shut it down (volumes persist)
supabase status   # print URLs and anon / service-role keys
supabase db reset # drop DB, re-run migrations from scratch
```

## Where to look for help

- Dev workflow, common errors, port map, env layout: [.claude/skills/local-dev-setup/SKILL.md](.claude/skills/local-dev-setup/SKILL.md)
- Supabase CLI reference: <https://supabase.com/docs/reference/cli>
- Edge Function reference: <https://supabase.com/docs/guides/functions>
