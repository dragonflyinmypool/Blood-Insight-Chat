---
name: commit
description: Create a git commit attributed ONLY to the user (no Claude Co-Authored-By trailer, no "Generated with Claude Code" footer) after a secret scan and a safety/best-practice pass over the staged changes. Use whenever the user asks for a commit.
---

# Commit (user-only, security-screened)

Produce a safe, clean commit where the user is the sole author. Scan for secrets and risky content **before** writing the commit, not after.

## Hard rules

- **No Claude attribution.** Do NOT append `Co-Authored-By: Claude …`, `🤖 Generated with [Claude Code]…`, or any AI/tooling footer to the message or PR body.
- **Do not set `--author`** to anything other than the repo's configured git user.
- **Do not skip hooks** (`--no-verify`) or bypass signing (`--no-gpg-sign`, `-c commit.gpgsign=false`) unless the user explicitly asks.
- **Never amend** an existing commit unless the user explicitly asks — always create a new commit.
- **Never `git add -A` or `git add .`** — stage files by explicit path so nothing unexpected is swept in.
- **Do not push** after committing unless the user explicitly asks.
- **Only commit when the user has asked.** If unclear, stop and confirm first.

## Procedure

### 1. Inspect the working tree

Run in parallel:
- `git status` (no `-uall`)
- `git diff` and `git diff --staged`
- `git log -n 5 --oneline` (to match this repo's commit-message style)

### 2. Security + safety screen

Before staging anything, scan the full diff + the list of untracked files you're about to add. Block the commit (and tell the user) if any of these are present:

**Secret patterns in diff content:**
- API keys / tokens: `sk-…`, `pk_live_…`, `xox[baprs]-…` (Slack), `ghp_…` / `gho_…` / `ghs_…` (GitHub), `AIza…` (Google), `AKIA…` (AWS access key), `ASIA…`, `eyJhbGciOi…` (JWT-looking) — treat as secret unless obviously a test fixture.
- AWS secret-key-shaped strings (40 char base64), long `Bearer …` tokens, `Authorization:` headers with real values.
- `BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY`
- `password\s*[:=]`, `passwd\s*[:=]`, `secret\s*[:=]`, `api[_-]?key\s*[:=]` with a non-placeholder value (anything other than `""`, `"changeme"`, `"<...>"`, `${...}`, `process.env.*`, etc.).
- Hardcoded DB connection strings with credentials: `postgres://user:pass@…`, `mongodb+srv://user:pass@…`, etc.
- `.pem`, `.p12`, `.pfx`, `.key`, `id_rsa`, `id_ed25519`, `*.keystore`, `credentials.json`, `service-account*.json`, `.npmrc` with `_authToken`, `.pypirc` with a password.

**Files that should almost never be committed:**
- `.env`, `.env.*` (except `.env.example` / `.env.sample` — and even then confirm they contain only placeholders)
- `*.sqlite`, `*.db`, local database dumps
- `node_modules/`, `.venv/`, `__pycache__/`, build output (`dist/`, `build/`, `.next/`, `out/`), `coverage/`
- Large binaries (> ~1 MB) unless the repo clearly tracks them (Git LFS, assets folders)
- IDE/OS noise: `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` (unless intentionally tracked)

**Other red flags:**
- Debug/TODO artifacts: `console.log`, `print(` / `pp(`, `debugger`, `dbg!`, leftover `it.only` / `describe.only`, commented-out blocks of code.
- Absolute local paths pointing to the user's machine (`/home/…`, `/Users/…`, `C:\Users\…`).
- Internal hostnames, Slack webhook URLs, staging/prod URLs with embedded credentials.

**If you find any of the above:**
1. Stop. List the findings to the user with file + line.
2. Recommend the fix (move to `.env`, add to `.gitignore`, delete the file from staging, rotate the secret if it's real).
3. If the user confirms the match is a false positive (e.g., test fixture, documented example), proceed — otherwise wait.
4. If a real secret was already committed in an earlier commit, tell the user to **rotate it immediately** — removing it from history alone is not enough.

### 3. Draft the commit message

- 1–2 sentences, focused on **why**, not what (the diff shows what).
- Match the style of recent commits (imperative mood, sentence case vs. lowercase, conventional-commits prefix or not, etc.).
- Do **not** mention Claude, AI, an assistant, generation, or this skill in the message.
- Do not reference private tickets/URLs the user didn't already put in the repo.

### 4. Stage and commit

Stage files by explicit path. Then commit with a HEREDOC and **no trailers**:

```bash
git commit -m "$(cat <<'EOF'
<your message here>
EOF
)"
```

Do not pass `-i`, `--amend`, `--no-verify`, or `--author`.

### 5. Verify

Run `git status` after the commit to confirm it landed and the tree is clean (or that only the remaining unrelated files are left).

### 6. Handle hook failures correctly

If a pre-commit hook fails:
1. The commit did **not** happen. Do not `--amend` — that would modify the *previous* commit.
2. Fix the underlying issue the hook flagged.
3. Re-stage the fixed files.
4. Create a **new** commit with the same message.

## What to tell the user at the end

One or two sentences: the commit SHA (short), the message, and — if relevant — what you deliberately did *not* stage (e.g. "left `.env.local` unstaged", "skipped `dist/` build output"). Don't push.
