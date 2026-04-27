# Blood Insight Chat — project guide

Web app where authenticated users upload blood-test PDFs, have biomarkers extracted by an LLM, track them over time, and chat with an AI grounded in their lab results. Next.js 15 frontend, Supabase backend (Postgres + Storage + Edge Functions + Auth).

## Stack at a glance

- **Frontend:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york).
- **Data + auth + storage + functions:** Supabase, managed locally by the Supabase CLI.
- **AI:** Two Deno Edge Functions (`upload-blood-test`, `chat-send`) that call OpenAI — compatible with LM Studio locally via `OPENAI_BASE_URL`.
- **Runtime split:** Next.js runs on the host (`pnpm dev`). Supabase (including edge functions) runs in its own Docker stack (`supabase start`). **There is no custom backend server and no Next.js API routes** — the app talks to PostgREST + Edge Functions directly.

## Running locally

```bash
supabase start     # Postgres, Storage, Edge Functions, Studio (:54321 / :54323)
pnpm dev           # Next.js on :3000 (Turbopack)
```

First-time setup, env layout, troubleshooting, migration workflow, and "how to add a feature" recipes live in [.claude/skills/local-dev-setup/SKILL.md](.claude/skills/local-dev-setup/SKILL.md). Load that skill for any dev-env, schema, or tooling question.

## Skills (load when relevant)

- **[local-dev-setup](.claude/skills/local-dev-setup/SKILL.md)** — running/stopping/resetting the stack, env vars, migrations, edge functions, type regeneration, port map, common errors. Load for anything dev-env or tooling related.
- **[blood-insight-context](.claude/skills/blood-insight-context/SKILL.md)** — product flow, domain concepts (biomarker, reference range, status, dedup), non-obvious business rules, schema map, where the extraction and chat prompts live. Load before touching uploads, biomarkers, chat, or the schema.
- **[commit](.claude/skills/commit/SKILL.md)** — secret-screened, user-attributed commits (no Claude Co-Authored-By trailers, no `git add -A`, no amending). Load whenever the user asks for a commit.
- **[provision-supabase-env](.claude/skills/provision-supabase-env/SKILL.md)** — bring up a brand-new hosted Supabase project (dev/staging/prod): push schema, deploy edge functions, set secrets, configure auth, wire up `.env` and GitHub Secrets. Load when adding a new environment.

## Load-bearing facts to keep in mind

- **Every domain row is user-owned.** Tables have `user_id uuid default auth.uid()` with RLS policies scoped to `auth.uid() = user_id`. The app never filters manually — trust RLS. Anon users get empty results, not 403.
- **Middleware handles protection + onboarding.** [middleware.ts](middleware.ts) → [lib/supabase/middleware.ts](lib/supabase/middleware.ts) redirects unauthenticated users to `/login`, signed-in users away from `/login`/`/signup`, and un-onboarded users to `/onboarding`. Don't add auth checks in individual pages — it's already done.
- **Two route groups in `app/`:** `(app)/*` is everything behind auth (has the AppShell layout). `(auth)/*` is public auth pages (has the centered-card layout). The group layout at [app/(app)/layout.tsx](<app/(app)/layout.tsx>) does its own auth check before mounting the shell.
- **Cache the user/profile fetch.** Use `getCurrentUser()` / `getCurrentProfile()` from [lib/supabase/current-user.ts](lib/supabase/current-user.ts) in Server Components — they're wrapped in `React.cache()` so multiple calls within one render dedupe.
- **Edge functions run in Deno, not Node.** Imports use `npm:` or `jsr:` specifiers. The `supabase/` directory is excluded from the Next.js `tsconfig.json` for this reason. Functions require the caller's JWT (`Authorization: Bearer <access_token>`) so RLS applies inside Deno too.
- **Sign out is client-side.** [components/user-menu.tsx](components/user-menu.tsx) calls `supabase.auth.signOut()` from the browser client, because nesting a `<form>` inside a Radix portal caused the browser to reject the submit as "form not connected". The `app/auth/signout/route.ts` handler is kept as a fallback but isn't used.
- **Supabase types are generated, not hand-written.** Regenerate with `supabase gen types typescript --local > lib/supabase/types.ts`. Two gotchas documented in the local-dev-setup skill — delete a stray `Connecting to db 5432` line and ensure `__InternalSupabase: { PostgrestVersion: "12" }` is at the top of the Database type.

## Conventions

- **Server Components by default.** Add `"use client"` only when you need state, effects, or browser APIs. Query patterns use `createClient()` from [lib/supabase/server.ts](lib/supabase/server.ts) for Server Components and [client.ts](lib/supabase/client.ts) for client components.
- **Force-dynamic where reads need freshness.** Pages that read mutable data use `export const dynamic = "force-dynamic"`. Auth pages are force-dynamic because they read cookies/search params.
- **Migrations are append-only.** Never edit an existing file in `supabase/migrations/`. Create a new one with `supabase migration new <name>`, then `supabase db reset` locally to re-apply.
- **Commit messages** use imperative short titles ("Add X", "Migrate from Y to Z"). Prior commits in the repo set the tone.

## What NOT to do

- Don't add Drizzle, Prisma, or an Express server. The whole point of the Supabase migration was to delete them. Any "we need an API route for X" is almost certainly better served as an Edge Function (AI work) or a direct PostgREST call (CRUD).
- Don't weaken RLS to "just get something working." If a query returns empty when it shouldn't, fix the policy or use the service role key in an edge function — never `alter table ... disable row level security`.
- Don't commit `.env`, `supabase/functions/.env`, or real OpenAI keys. `.gitignore` covers them but be deliberate — `git check-ignore <file>` confirms.
- Don't add Docker Compose back for the app. Next.js runs on the host. Only Supabase runs in Docker (via the CLI).
