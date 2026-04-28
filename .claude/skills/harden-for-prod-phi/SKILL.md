---
name: harden-for-prod-phi
description: Production-readiness checklist for moving Blood Insight Chat from a free MVP to handling real patient health data (PHI). Covers BAAs with Supabase and OpenAI, storage privacy verification, hardened in-function auth, audit logging, and backup/incident response. Load when the user says "going to prod", "real patients", "HIPAA", "going live", "first real users", "compliance review", or before shipping anything that handles non-test patient data.
---

# Harden Blood Insight Chat for production PHI

This is the deferred-from-MVP security checklist. Today the app runs with the **minimum-viable** security posture — fine for solo testing, **not fine for real patient data**. This skill is the path from "works on the demo" to "legally and technically safe to handle PHI."

## Why this exists

When we first deployed (April 2026), we accepted shortcuts to ship: `verify_jwt = false` on edge functions with no extracted auth helper, no BAA in place, no audit on storage policies, no PHI-in-logs review. Those decisions are documented here so future-us doesn't trip on the same wires twice.

Load this skill before:

- Onboarding any user who isn't us.
- Adding marketing copy that says "secure" or "HIPAA-compliant."
- Connecting a custom domain (implies a public, claimable product).
- A compliance review or SOC2/HIPAA audit.

## Current state (as of MVP cutover, 2026-04-28)

| Layer | MVP state | Risk |
|---|---|---|
| **Supabase BAA** | None | Storing PHI on Supabase without a BAA is a HIPAA violation. |
| **OpenAI BAA** | None | We send PDF contents (PHI) to OpenAI for extraction without a BAA. Legal exposure + violates OpenAI's terms for PHI workloads. |
| **Edge function auth** | `verify_jwt = false` + in-function `supabase.auth.getUser()` (single function-level check) | Auth check exists but is duplicated across functions. A future refactor could remove it silently — no test asserts unauth → 401. |
| **Storage bucket policy** | Unaudited | We `{user_id}/{hash}.pdf` keys, but the bucket policy needs explicit verification that no public read/list is allowed. |
| **RLS on PHI tables** | Enabled per [CLAUDE.md](../../../CLAUDE.md) | Trust the policies, but verify they're tested. |
| **PHI in logs** | Unaudited | Function logs may contain PDF text or extracted markers. PHI in logs requires special handling under HIPAA. |
| **Backup / incident response** | Inherited from Supabase defaults | Not documented or tested. |

## Step 1 — Legal: BAAs

Without these, **everything else is theatrical** — you can't legally process PHI regardless of how secure the code is.

### Supabase BAA
1. <https://supabase.com/dashboard> → org settings → enable the **HIPAA add-on** (paid tier).
2. Sign Supabase's BAA.
3. Migrate the project to a **HIPAA-eligible Supabase project** (separate from the dev project — Supabase docs: <https://supabase.com/docs/guides/platform/hipaa-projects>).
4. Use this skill's sibling [provision-supabase-env](../provision-supabase-env/SKILL.md) to spin up a dedicated `blood-insight-chat-prod` project on the HIPAA tier and migrate.

### OpenAI BAA
1. OpenAI only signs BAAs on the **Enterprise** tier — verify pricing and apply at <https://openai.com/enterprise/>.
2. Until BAA is signed, **PHI cannot be sent to OpenAI**, full stop.
3. If Enterprise isn't viable, alternatives: Azure OpenAI (BAA-eligible on Azure), AWS Bedrock with Anthropic Claude (BAA via AWS), or run a self-hosted model. Any switch needs the `OPENAI_BASE_URL` updated in `supabase secrets set`.

## Step 2 — Re-harden edge function auth

Move from "single check per function" to "extracted helper + integration test."

### Extract auth into `_shared/auth.ts`

Create `supabase/functions/_shared/auth.ts`:

```ts
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export type AuthedRequest = {
  user: { id: string; email?: string };
  supabase: SupabaseClient;
};

/**
 * SECURITY-CRITICAL — DO NOT REMOVE OR INLINE THIS CHECK.
 * This is the only thing standing between an anonymous request and PHI.
 * Edge function gateway-level verify_jwt is intentionally OFF (so CORS
 * preflight passes) — auth is enforced HERE.
 */
export async function requireUser(req: Request): Promise<AuthedRequest | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  return { user, supabase };
}
```

Refactor both functions ([upload-blood-test/index.ts](../../../supabase/functions/upload-blood-test/index.ts), [chat-send/index.ts](../../../supabase/functions/chat-send/index.ts)) to call `requireUser(req)` immediately after the OPTIONS branch, and bail if the result is a `Response`. The duplicated 20-line auth blocks go away — and a future "let me clean up these functions" refactor can't accidentally drop the check without removing an explicit import.

### Integration test that asserts 401 without auth

Add a test that hits both deployed functions with no Authorization header and asserts a 401 response. Wire it into the deploy GitHub Action so a regression in `requireUser` blocks merge.

### Reconsider gateway-level `verify_jwt`

Supabase's 2026 guidance is "handle JWT verification in the function" — `verify_jwt = false` is the documented pattern. But for defense-in-depth, evaluate moving to **JWT Signing Keys** (<https://supabase.com/docs/guides/auth/signing-keys>) which provide gateway-level cryptographic verification compatible with CORS preflight.

## Step 3 — Audit storage bucket privacy

The PDFs are PHI. Bucket policy must allow **only the owning user** to read their own object.

```bash
# Confirm bucket exists and is private:
supabase storage list --project-ref <ref>
# In the dashboard: Storage → bucket → Policies. Should be:
#   - public: false
#   - INSERT/SELECT/UPDATE/DELETE: only where bucket_id = '<our-bucket>' AND
#     auth.uid()::text = (storage.foldername(name))[1]
```

If a public read policy exists from any earlier experiment, **remove it**. Then add an explicit RLS test (sign in as user A, attempt to download user B's PDF, assert failure).

## Step 4 — PHI in logs review

Search both edge function bodies for `console.log` / `console.error` calls that include:
- Raw PDF text
- Extracted biomarker values + names + units
- User email, name, or any identifier
- Full request/response bodies

Replace with redacted variants (log `pdf_size`, `marker_count`, `user_id` is OK, but `marker_value` for `glucose` is PHI).

For the chat function specifically, the LLM stream may contain PHI — make sure we're not logging full streams.

Set up Supabase log retention to the minimum necessary (HIPAA requires retaining audit logs but not arbitrary application logs).

## Step 5 — Audit logging

HIPAA requires an audit trail of who accessed what PHI when. Today we have nothing.

Minimum: a `phi_access_log` table populated by triggers on `blood_test_results` SELECT (or a logging wrapper in the chat function) recording `{user_id, timestamp, action, resource_id}`. Keep ≥ 6 years per HIPAA.

## Step 6 — Backup and incident response

- Confirm Supabase **Point-in-Time Recovery** is enabled on the prod project (Pro plan requirement).
- Document the recovery procedure: who triggers a restore, target RPO/RTO, communication plan.
- Document a breach response plan: HIPAA requires notification within 60 days of discovery for breaches affecting ≥ 500 people. Even sub-500 breaches need annual reporting.

## Step 7 — Pen test or third-party security review

Before opening to public signup, get someone outside the project to attempt to:
- Read another user's PDFs
- Read another user's chat threads
- Bypass RLS via SQL injection in chat input
- Bypass auth on edge functions
- Extract data from the LLM via prompt injection in PDF content (medical records can be adversarial)

## Anti-checklist (don't do these)

- **Don't** disable RLS "just to debug." Use `auth.set_authenticated()` in psql, or use the service role key in a controlled environment.
- **Don't** ship a "share my results with my doctor" link that bypasses auth. Use signed URLs with short TTLs and access logging.
- **Don't** copy production data to staging or local dev. PHI does not leave the prod project. Use synthetic data for dev/testing.
- **Don't** add analytics or third-party scripts (Sentry, PostHog, GA) on pages that render PHI without confirming each vendor has a BAA. If unclear, assume no.

## Done means

- BAAs with Supabase and OpenAI (or alternative LLM provider) on file.
- Production runs on a dedicated HIPAA-tier Supabase project, separate from dev.
- `_shared/auth.ts` exists, both functions use it, and an integration test verifies 401-without-auth.
- Storage bucket policies audited and tested for cross-user isolation.
- PHI-in-logs audit complete; log retention configured.
- `phi_access_log` table populated by every PHI read.
- PITR enabled, recovery procedure documented and tested.
- Third-party security review completed with no high-severity findings.

Until every box is checked, the product description must not include "HIPAA-compliant" or "secure for medical data." Lying about compliance is its own legal exposure.
