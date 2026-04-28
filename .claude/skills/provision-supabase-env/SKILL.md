---
name: provision-supabase-env
description: Provision a new hosted Supabase project (dev / staging / prod) and wire it up to the app — push schema, deploy edge functions, configure auth, set GitHub Actions secrets. Use when bringing a new environment online or when the user says "set up Supabase for staging/prod", "deploy schema to a new project", "create a new env".
---

# Provision a hosted Supabase environment

End-to-end recipe for taking a brand-new Supabase project from empty to "the app works against it." Each environment (dev, staging, prod) is a separate Supabase project — they don't share a database. Repeat this whole flow per env.

## TL;DR — minimum to make the app actually work

Skip any of these and the app *looks* deployed but breaks the moment a user tries to do something:

- [ ] **Step 1:** schema pushed (`supabase db push`) — without this, login/signup throws on missing tables.
- [ ] **Step 2:** **edge functions deployed** (`upload-blood-test`, `chat-send`) — without this, **PDF upload fails with `Failed to send a request to the Edge Function`** and chat does nothing.
- [ ] **Step 3:** **`OPENAI_API_KEY` (+ `OPENAI_BASE_URL`, `AI_MODEL`) set as Supabase secrets** — without this, uploads return empty extraction and chat replies are blank. Functions read these from Supabase's secrets store at runtime, **not** from any local `.env`.
- [ ] **Step 4:** Auth Site URL / Redirect URLs match the deployed origin — without this, signup confirmation emails point at `localhost`.
- [ ] **Step 5:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set wherever the app builds (host CI **build variables**, not just runtime).

Steps 2 + 3 are the ones easiest to forget because the build still succeeds without them — the failure only shows up when a user clicks "Upload PDF" in production.

## Step 0. Create the project in the dashboard

User does this manually:

1. <https://supabase.com/dashboard> → **New project**
2. Pick org, name (e.g. `blood-insight-chat-staging`), pick region close to users, set a strong DB password — **save this password**, you'll need it for `db push` from CI later.
3. Wait ~2 min for the project to provision.

Capture from **Project Settings → General**:
- **Reference ID** (e.g. `vqpfccotzjyfjuhtywej`)

Capture from **Project Settings → API → Project API keys**:
- **Publishable key** (`sb_publishable_...`) — public, safe to embed in client.
- **Secret key** (`sb_secret_...`) — keep in a password manager / GitHub Secrets only.

Project URL is `https://<reference-id>.supabase.co`.

## Step 1. Push the schema

From a checkout of the repo, with the Supabase CLI installed (`supabase --version` should work):

```bash
supabase login                              # one-time per machine, opens a browser
supabase link --project-ref <reference-id>
supabase db push                            # applies every migration in supabase/migrations/ in order
```

Verify with:

```bash
supabase migration list
```

Local and Remote columns should match for every row. If a migration fails midway, fix the SQL in a **new** migration file (never edit applied ones) and re-run `db push`.

## Step 2. Deploy edge functions

> **Don't skip this — it's the #1 forgotten step.** Migrations push the schema but **not** the functions. If you skip this, the app deploys cleanly but the moment a user uploads a PDF the browser shows `Failed to send a request to the Edge Function` (because the URL `/functions/v1/upload-blood-test` 404s).

```bash
supabase functions deploy upload-blood-test
supabase functions deploy chat-send
```

Verify both appear and show "Active":

```bash
supabase functions list --project-ref <reference-id>
```

Or check <https://supabase.com/dashboard/project/{ref}/functions>.

## Step 3. Set edge function secrets

> **Also easy to forget — the build doesn't need these, but the functions are useless without them.** With Step 2 done but Step 3 skipped, uploads succeed at the network level but extraction returns empty (`OPENAI_API_KEY` undefined), and chat responses come back blank.

These env vars live in Supabase's secrets store, **not** in any local `.env` and **not** baked into the function code. `supabase/functions/.env` is local-dev only — it does not sync up on `functions deploy`. Edge functions also can't reach `host.docker.internal`, so LM Studio is local-only — hosted needs a real LLM endpoint.

Inline:

```bash
supabase secrets set \
  OPENAI_API_KEY=sk-... \
  OPENAI_BASE_URL=https://api.openai.com/v1 \
  AI_MODEL=gpt-4o-mini
```

Or from a file (cleaner — same `.env` you'd use for `functions serve`):

```bash
supabase secrets set --env-file supabase/functions/.env
```

Verify with `supabase secrets list` — values are masked but names should appear. After changing a secret, **redeploy the function** (`supabase functions deploy <name>`) for the new value to take effect on the running instance.

## Step 4. Configure Auth in the dashboard

**Project Settings → Authentication → URL Configuration:**

- **Site URL:** the public origin where the Next.js app will run for this env. Examples:
  - dev (local): `http://localhost:3000`
  - staging: `https://staging.example.com`
  - prod: `https://app.example.com`
- **Redirect URLs:** add the same origin plus the auth callback paths:
  - `<site-url>/auth/callback`
  - `<site-url>/auth/confirm`
  - `<site-url>/reset-password`

**Project Settings → Authentication → Providers → Email:**

- **Confirm email:** off for dev, on for staging/prod (so signups verify they own the address).
- **Secure password change:** on for prod.

If you change any of these, sign-out and sign-in once to refresh JWTs.

## Step 5. Wire up the local app (or CI)

### Local dev pointing at hosted

Edit `.env` (gitignored — safe to put real values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<reference-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Stop local Supabase if it's running (you don't need both):

```bash
supabase stop
```

Then `pnpm dev` will talk to the hosted project.

### CI (production builds)

Add as **GitHub repo Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<reference-id>.supabase.co` | `build-image.yml` build args |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key | same |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from <https://supabase.com/dashboard/account/tokens> | future CI steps that auto-push migrations / functions |
| `SUPABASE_PROJECT_REF` | The reference ID | same |
| `SUPABASE_DB_PASSWORD` | DB password from Step 0 | `supabase db push` from CI |

Service role / Secret key is **not** needed unless we add admin operations.

`NEXT_PUBLIC_*` values are baked into the client bundle at build time — that means a single image is tied to one Supabase project. Per-env images means rebuilding with different build-args. (Workaround: switch to a runtime-config pattern — out of scope here.)

## Step 6. Smoke test

Run `pnpm dev` against the hosted project, then:

1. Sign up at `/signup` with a new email — confirm a row appears in `auth.users` and `public.profiles` (Studio: <https://supabase.com/dashboard/project/{ref}/editor>).
2. Complete onboarding at `/onboarding`.
3. Upload a small PDF — check the `upload-blood-test` function logs in the dashboard for AI extraction output. New rows in `blood_tests` and `blood_test_results`.
4. Open a chat from the test → send a message → verify it streams back.

If extraction returns nothing, check `supabase functions logs upload-blood-test` — usually `OPENAI_API_KEY` is unset or wrong, or the model name is invalid.

## Common errors

**`supabase db push` fails with "schema migration history mismatch"** — you applied SQL manually in the dashboard before pushing. Use `supabase migration repair --status applied <timestamp>` to mark already-applied migrations, or `supabase db reset` if the project has no production data yet.

**Browser shows "Failed to send a request to the Edge Function" on upload** — the function isn't deployed to the hosted project. `supabase db push` only applies migrations; functions need a separate `supabase functions deploy <name>` (Step 2). Verify with `supabase functions list --project-ref <ref>`.

**Upload succeeds but extraction is empty / chat returns blank** — `OPENAI_API_KEY` isn't set as a hosted-project secret (Step 3), or it's set on local-dev only. Check with `supabase secrets list`. Remember to redeploy the function after changing a secret.

**Edge function returns 401 from the app even after deploy** — `Authorization: Bearer <publishable-key>` is the wrong header for our functions. The client must pass the user's `session.access_token`, not the anon key. The `supabase.functions.invoke()` browser helper does this automatically; manual `fetch` does not.

**Email links go to the wrong domain** — `Site URL` in Auth settings is the source of truth. Update it and any sent-but-not-clicked links from before still point to the old URL.

**`supabase functions deploy` says "function not found in config.toml"** — the function exists on disk but isn't registered. Check `supabase/config.toml` has a `[functions.<name>]` block with `enabled = true`.

**Different project across machines** — `.supabase/` in the repo root caches the linked project. If a teammate has a different env linked, run `supabase link --project-ref <theirs>` to re-link. The `.supabase/` dir is git-ignored.
