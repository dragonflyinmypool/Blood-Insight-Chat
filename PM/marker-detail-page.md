# Marker detail page — design

## Goal

When a user clicks a marker row on `/results`, take them to a page that shows
the marker's history as a chart with the healthy reference band shaded behind
the line, plus a verifiable trail back to each source PDF.

## Route + linking

- New route: `app/(app)/results/[marker]/page.tsx`
- `[marker]` is the URL-encoded canonical marker name (lowercased), e.g.
  `/results/ldl%20cholesterol`. We slug on lowercase to match the same
  case-insensitive grouping the results page already uses.
- On `/results`, wrap the marker name cell in `<Link href={`/results/${encodeURIComponent(m.marker_name.toLowerCase())}`}>`.
  Whole row stays a `TableRow` (no nested anchors); just the marker name is the link, hover-underlined.

## Data the page needs

Server Component, force-dynamic. Two queries (parallel):

1. **All readings for this marker** (case-insensitive match on `marker_name`):
   ```
   blood_test_results
     select id, marker_name, value, unit, reference_range_low, reference_range_high,
            status, category, blood_test_id
     ilike marker_name <marker>
   ```
   RLS scopes to the user automatically.

2. **Joined blood tests** for those `blood_test_id`s (one round trip via `.in`):
   `select id, file_name, test_date, lab_name, content_hash, created_at`.
   Need `content_hash` to build the storage path (`{user_id}/{content_hash}.pdf`)
   and `test_date` / `created_at` to plot.

Empty state: if no readings, render a small card linking back to `/results`.

## Layout

```
┌─ Header ──────────────────────────────────────────────┐
│  ← Back to results                                    │
│  HDL Cholesterol                          [Lipids]    │  ← category badge
└───────────────────────────────────────────────────────┘

┌─ History (Card) ──────────────────────────────────────┐
│                                                       │
│   [recharts LineChart, ~280px tall]                   │
│   - X axis: test_date (fallback created_at), formatted MMM yyyy
│   - Y axis: value, padded ~10% above/below extremes    │
│   - Reference band: ReferenceArea y1=ref_low y2=ref_high, soft success color
│   - Open-ended ranges (eGFR ≥ 60): ReferenceArea from ref_low → chart top
│   - Line: monotone, dots at each reading; dot color by status
│   - Tooltip: date · value unit · status                │
│                                                       │
│   Range: 40 – 60 mg/dL                                │
└───────────────────────────────────────────────────────┘

┌─ Readings (Card) ─────────────────────────────────────┐
│  Date          Value       Status     Source          │
│  Apr 12, 2026  58 mg/dL    normal     Quest_2026.pdf →│
│  Jan 03, 2026  52 mg/dL    normal     LabCorp_Q1.pdf →│
│  …                                                    │
└───────────────────────────────────────────────────────┘
```

Sort newest-first in the table; oldest-left in the chart.

## Reference band

- Take `ref_low` / `ref_high` from the most recent reading (they're stamped
  per-result, so historical rows that pre-date a range update keep the value
  they had at upload time — but for the "good band" we want today's truth).
- If `ref_low` and `ref_high` are both null → no shaded area; show a small
  "No reference range available" hint above the chart.
- If only one bound is set (open-ended like eGFR) → shade from that bound to
  the chart edge, not edge-to-edge across both axes.
- If readings have inconsistent units across history (e.g. mg/dL vs mmol/L) →
  show all readings in the table with their unit, but only chart readings
  whose unit matches the latest reading's unit. Add a small footnote: "N
  reading(s) hidden from chart due to different units."

## Source PDF link

Each row in the readings table has a "Source" cell with the file name and an
external-link icon. Click → opens the PDF in a new tab.

The bucket `blood-tests` is **private**, so we can't link `getPublicUrl`. Two
options:

- **A. Server action that returns a signed URL.** Click → `useTransition` →
  call action → `window.open(url)`. Same pattern as
  [tests/row-actions.tsx:34](<../app/(app)/tests/row-actions.tsx>) already uses on
  the client — lift that into a small `<PdfLink>` client component and reuse.
- **B. Server-render signed URLs at page load.** Simpler (no client JS), but
  the URLs expire after 60s, so a user who reads the chart for a minute and
  then clicks gets a 400.

→ Go with **A**. Reuse the existing client-side signing pattern.

## Status / abnormal accents

Match the existing badge palette (`destructive` for high/critical, `warning`
for low, `success` for normal). Dots on the line use the same color so a
trend of good → bad is visually obvious.

## Out of scope (this round)

- Editing or annotating a reading.
- Showing readings from other people / aggregate norms.
- Markdown explainer of what the marker means (could be a follow-up;
  `marker_categories.description` only describes the category, not the marker).
- Export / share.
- Zoom / pan on the chart — recharts default is fine for a handful of dots.

## Files touched

- New: `app/(app)/results/[marker]/page.tsx` (Server Component, fetches data)
- New: `app/(app)/results/[marker]/marker-history-chart.tsx` (`"use client"`, recharts)
- New: `app/(app)/results/[marker]/pdf-link.tsx` (`"use client"`, signed-URL open)
- Edit: `app/(app)/results/page.tsx` — wrap marker name in `<Link>`

No new dependencies (recharts already in `package.json`).
