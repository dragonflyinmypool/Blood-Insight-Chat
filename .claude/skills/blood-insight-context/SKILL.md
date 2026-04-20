---
name: blood-insight-context
description: Load domain/business context for the Blood Insight Chat app — what it does, core concepts (biomarkers, reference ranges, status, dedup), AI grounding rules, and a map of key files. Use at the start of any task touching uploads, biomarkers, chat, or the schema so you don't re-explain the app.
---

# Blood Insight Context

Personal blood-test management app. Users upload lab PDFs → an LLM extracts biomarkers with reference ranges → results are stored and tracked over time → users chat with an AI that is grounded in their actual lab data. Every user sees only their own data (Supabase Auth + RLS scoped on `user_id = auth.uid()`).

## Product flow (end-to-end)

1. **Upload** — user uploads a blood-test PDF from the dashboard.
2. **Extract** — the LLM parses PDF text and returns structured `{ test metadata, markers[] }` with JSON schema enforcement.
3. **Deduplicate** — SHA256 of the PDF's bytes is compared against existing `blood_tests.content_hash`. Same hash ⇒ reject as duplicate.
4. **Store** — metadata in `blood_tests`, each biomarker in `blood_test_results`.
5. **Analyze** — dashboard shows total tests, total markers, abnormal count, latest test date, top-10 common markers, recent tests list.
6. **Chat** — a conversation can be linked to a specific `blood_test` (AI sees every marker from that test) or unlinked (AI sees summaries of the 5 most recent tests). Responses stream to the client.

## Core domain concepts

- **Marker / Biomarker** — one measurable lab value (e.g. Hemoglobin, Glucose, LDL).
- **Reference range** — `low` / `high` bounds that define "normal" for a marker.
- **Status** — one of `normal | high | low | critical`. Determined **by the LLM at extraction time** from value vs. reference range. `critical` = significantly out of range (LLM's judgment, not a numeric threshold).
- **Abnormal** — any status ≠ `normal`. Used for dashboard counts.
- **Content hash** — SHA256 hex of the uploaded PDF bytes. The duplicate-detection key.
- **Common markers** — top-10 most frequent marker names across all of a user's tests, surfaced on the dashboard.

## Non-obvious business rules

- **Everything is translated to English.** Marker names, units, lab names, patient names — regardless of the PDF's source language. Don't preserve original-language fields unless the user asks.
- **Status is LLM-assigned, not recomputed.** When editing extraction, trust the LLM output; don't post-process a numeric compare unless you also audit edge cases (unit mismatch, ratio markers, ranges like "<5", "negative", etc.).
- **Dedup is by file bytes, not by parsed content.** Re-scanning the same PDF after a reprocess isn't a new upload. A re-export of the same report from the lab with different bytes *will* be treated as a new test — this is known and accepted.
- **Chat grounding depends on linkage.** Linked conversation ⇒ full marker list for that test in the system prompt. Unlinked ⇒ summary-level context for the 5 most recent tests only. Don't silently change this without surfacing it to the user.
- **Always recommend consulting a healthcare provider.** The chat system prompt includes this. Preserve it in any edits — it's the medical-safety guardrail, not boilerplate.

## Database schema

In [supabase/migrations/](../../../supabase/migrations/):

- `profiles` — `id (uuid, FK auth.users), display_name, onboarded, created_at, updated_at`. Auto-populated by `on_auth_user_created` trigger on signup.
- `blood_tests` — `id, user_id (FK auth.users, defaults to auth.uid()), file_name, test_date, lab_name, patient_name, content_hash (SHA256, unique per user), notes, created_at`
- `blood_test_results` — `id, blood_test_id FK, marker_name, value, unit, reference_range_low, reference_range_high, status, raw_text`. Ownership inherited via FK.
- `chat_conversations` — `id, user_id, title, blood_test_id FK (nullable), created_at`
- `chat_messages` — `id, conversation_id FK, role (user|assistant|system), content, created_at`. Ownership inherited via FK.
- `blood_test_summary()`, `marker_list()` — RPCs (SECURITY INVOKER, so RLS applies).

**RLS** is on for every table; anon sees nothing, `authenticated` sees only their own rows. Edge Functions use the caller's JWT (not service-role) so RLS applies there too.

Schema changes go in a **new** SQL migration file under [supabase/migrations/](../../../supabase/migrations/). Don't edit existing migration files. After changing schema, regenerate types: `supabase gen types typescript --local > lib/supabase/types.ts` (then delete the stray `Connecting to db 5432` line if it appears at the top, and ensure `__InternalSupabase: { PostgrestVersion: "12" }` is present on the Database type).

## File map

- **Upload + extraction (Edge Function):** [supabase/functions/upload-blood-test/index.ts](../../../supabase/functions/upload-blood-test/index.ts)
  - `sha256Hex()` ≈ L17–21 — dedup key
  - `buildPrompt()` ≈ L40–72 — extraction prompt (English translation + status rules live here)
  - Duplicate check query ≈ L123–143
  - OpenAI extraction call ≈ L156–161
- **Chat (Edge Function):** [supabase/functions/chat-send/index.ts](../../../supabase/functions/chat-send/index.ts)
  - `buildSystemPrompt()` ≈ L24–79 — biomarker context injection + healthcare-provider reminder
- **Client upload UI:** [components/upload-dialog.tsx](../../../components/upload-dialog.tsx) — uses `supabase.functions.invoke()` so the user's JWT is attached automatically.
- **Chat UI (streaming):** [app/(app)/chat/[id]/chat-thread.tsx](../../../app/%28app%29/chat/%5Bid%5D/chat-thread.tsx) — gets `access_token` from `supabase.auth.getSession()` and fetches the edge function manually (needed for SSE; `invoke()` buffers).
- **Dashboard:** [app/(app)/page.tsx](../../../app/%28app%29/page.tsx) — calls `blood_test_summary()` RPC + recent tests list.
- **Protected group layout:** [app/(app)/layout.tsx](../../../app/%28app%29/layout.tsx) — checks auth + onboarded, mounts `AppShell`.
- **Middleware:** [lib/supabase/middleware.ts](../../../lib/supabase/middleware.ts) — session refresh, route protection, onboarding gate.
- **Cached user/profile fetch:** [lib/supabase/current-user.ts](../../../lib/supabase/current-user.ts) — wrap in `React.cache()` so layouts + pages share a render-scoped fetch.
- **Supabase server client:** [lib/supabase/server.ts](../../../lib/supabase/server.ts)

## Environment / model config

Edge Functions read from [supabase/functions/.env](../../../supabase/functions/.env):

- `OPENAI_API_KEY` — real key or any value for LM Studio
- `OPENAI_BASE_URL` — defaults to `http://host.docker.internal:1234/v1` (LM Studio from a container)
- `AI_MODEL` — e.g. `qwen2.5-14b-instruct-1m` locally, `gpt-4o-mini` for real OpenAI

The app is OpenAI-SDK-compatible, so any endpoint that speaks the OpenAI protocol (LM Studio, Ollama w/ compat shim, Azure OpenAI, etc.) works with just these three vars.

## When working on this project

- **Changing extraction behavior?** Edit `buildPrompt()` in `upload-blood-test/index.ts`. Re-check: English translation, status rules, JSON schema still matches DB columns.
- **Changing chat behavior?** Edit `buildSystemPrompt()` in `chat-send/index.ts`. Preserve the healthcare-provider reminder. Verify linked vs. unlinked branches both still get sensible context.
- **Adding a schema field?** New migration file. Update the extraction JSON schema + `buildPrompt()` if the field is LLM-extracted. Update the chat prompt if the field should ground responses.
- **Touching dedup?** Remember the key is file *bytes*, not parsed content. If you change the hash input, old rows won't match and re-uploads will appear new.
