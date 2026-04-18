# Blood Test Tracker

## Overview

A full-stack web app where users can upload blood test PDFs, have the results automatically extracted and stored, track biomarkers over time, and chat with an AI about their lab results.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/blood-test-tracker)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI gpt-5.2 via Replit AI Integrations (no user API key needed)
- **PDF parsing**: pdf-parse

## Features

- Upload blood test PDFs — AI extracts all markers, values, reference ranges, dates, lab name
- View test history with dates and marker counts
- See individual test results with normal/high/low status indicators
- Track any biomarker across all tests in a line chart
- Chat with an AI assistant that has context of your blood test results (SSE streaming)
- Dashboard with summary stats (total tests, abnormal markers, latest test date)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `blood_tests` — uploaded test metadata (fileName, testDate, labName, patientName, notes)
- `blood_test_results` — extracted markers (markerName, value, unit, referenceRangeLow, referenceRangeHigh, status)
- `chat_conversations` — chat sessions (title, bloodTestId for context)
- `chat_messages` — conversation messages (role, content)
- `conversations` + `messages` — OpenAI integration tables

## Architecture

- Frontend at `/` (blood-test-tracker artifact)
- API at `/api` (api-server artifact)
- PDF upload: base64 → API → OpenAI extracts data → stored in PostgreSQL
- Chat: SSE streaming from OpenAI gpt-5.2 with blood test context injected into system prompt
