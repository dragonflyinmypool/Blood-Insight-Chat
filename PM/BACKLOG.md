# Backlog

## Now

## Next

- [ ] Background upload — don't block the dialog while PDF is being processed
- [ ] Duplicate-upload UX — backend already returns 409 on duplicate hash; make sure the UI surfaces that message clearly to the user
- [ ] Manual corrections — edit extracted results after upload
- [ ] Personal profile — age, sex, weight, etc. to tailor expected ranges
- [ ] Profile-tailored expected ranges — age/sex/weight-aware ranges (either LOINC-ish dataset or a per-marker AI call grounded on profile)
- [ ] Key markers — improve selection logic (canonical list, abnormal-first, or user-pinned — currently ranked by frequency)

## Later

## Ideas

## Questions

- Where do expected/reference ranges come from? Today: AI extracts them from each PDF (prompt tells model to leave null if missing). If we want profile-tailored ranges (age/sex/weight-aware), we need either a ranges dataset or a second AI call grounded on profile + marker.

## Done

- Dashboard v1 — needs-attention, trending-toward-boundary, key-markers sparklines, recent tests
