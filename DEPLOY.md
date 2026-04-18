# Deploying to Railway

This repo was originally bootstrapped on Replit. These are the minimum steps to host it on Railway and develop locally.

## 1. Provision services

In a new Railway project, add two services:

1. **Postgres** (Railway plugin) — injects `DATABASE_URL` automatically.
2. **This repo** — connect the GitHub repo and point it at the branch you want to deploy.

## 2. Environment variables

Set these on the app service:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Auto-provided by the Postgres plugin (reference it from the variables panel). |
| `OPENAI_API_KEY` | yes | Your own OpenAI key. |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini`. Override to switch models. |
| `OPENAI_BASE_URL` | no | Only set if routing through a proxy / Azure / compatible API. |
| `PORT` | no | Railway sets this automatically; the server reads it. |

The app also still accepts the legacy Replit names (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) for now, but prefer the plain `OPENAI_*` names on Railway.

## 3. Build & start commands

Railway auto-detects `pnpm`. Set:

- **Build command:** `pnpm install && pnpm run build`
- **Start command:** `pnpm start`

The root `start` script runs the api-server bundle (`artifacts/api-server/dist/index.mjs`).

## 4. Push the schema

Once the app can reach Postgres, run the Drizzle push locally against Railway's `DATABASE_URL`:

```sh
DATABASE_URL="<railway-postgres-url>" pnpm db:push
```

(Or run it once from a Railway shell: `pnpm db:push`.)

## 5. Frontend

The React app in `artifacts/blood-test-tracker` is Vite-built to `dist/public/` and served by the api-server automatically (single service). Any non-`/api/*` path returns `index.html` so client-side routing works.

Override the served directory with `FRONTEND_DIST=/path/to/dist` if needed.

## Local development

```sh
pnpm install
export DATABASE_URL=postgres://...           # local or Railway
export OPENAI_API_KEY=sk-...
export PORT=3000
pnpm db:push                                  # first time only
pnpm --filter @workspace/api-server run dev
```
