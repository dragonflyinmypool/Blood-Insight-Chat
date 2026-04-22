# BYO-AI export

Let users take their results to whatever AI they already use (ChatGPT, Claude, etc.) instead of paying for chat inside the app. Cheap-tier alternative to in-app chat.

## Why

- In-app chat is costly and can be abused (users chatting about unrelated stuff).
- A "cheap" product tier could omit in-app chat entirely and lean on this export.
- Gives users flexibility — their own model, their own workflow.

## Design options considered

### Option A — Short-lived URL (original idea)

Click button → server generates tokenised URL containing user's test data as markdown/HTML → user pastes prompt like *"look at my data at <url>"* into their AI → AI fetches → URL expires in ~1 min.

Pros: small paste, self-contained prompt.
Cons: requires the AI to have browsing enabled (ChatGPT/Claude have it, not always on); needs server infra (token table, expiry, render route); 1-min TTL is tight for real user flow but wide for scrapers without good token entropy; extra moving parts.

### Option B — Clipboard-paste markdown (leaning toward this)

Click button → writes a markdown blob of the user's results directly to clipboard → toast with a short "paste this into your AI" tip. No server endpoint, no expiry, no token infra.

Pros: zero infra, zero cost exposure, works with any AI (no browsing needed), user can re-paste later.
Cons: data sits in clipboard until overwritten (user responsibility, same as any copy-to-clipboard feature).

Size check: 20 tests × ~30 markers × ~80 chars ≈ 50KB of markdown. ChatGPT / Claude / Gemini all handle pastes much bigger than that — not a concern.

## Decisions reached

- **Format:** markdown (cheaper tokens, more reliable LLM parsing than HTML).
- **Scope:** all tests, with a cap — "last 20 tests" as a starting limit.
- **Primary threat being defended against:** *our* cost exposure from users chatting in-app about unrelated things. Not scrapers. The user going to ChatGPT is the *point*, not the leak.
- **Gut direction:** Option B (clipboard). URL approach only pays rent if we later need features like "update the data after the user starts chatting" — not in scope.

## Open questions / picking up here

- Confirm Option B is the path, then design the button's placement (dashboard? per-test? both?).
- What exactly goes in the markdown blob? Proposed: test date, lab, each marker with value/unit/range/status, plus a short preamble telling the receiving AI it's blood-test data and to recommend consulting a healthcare provider.
- Do we ever want a "copy *this single test*" variant alongside "copy everything"?
- Product tier question: is this the *only* chat path for a cheap tier, or does it coexist with in-app chat for all users?

## Related backlog items

- `BACKLOG.md` → Ideas section has the seed of this + the "limit chat cost" note.
