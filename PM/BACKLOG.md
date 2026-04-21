# Backlog

## Now

## Next

- [ ] Background upload — don't block the dialog while PDF is being processed
- [ ] Duplicate-upload UX — backend already returns 409 on duplicate hash; make sure the UI surfaces that message clearly to the user
- [ ] Better dashboards — more useful insight views (cross-test comparison, timeline of actual test dates, trends, etc.)
- [ ] Charts — overlay expected range as reference lines (low/high) on biomarker trend graphs
- [ ] Manual corrections — edit extracted results after upload
- [ ] Personal profile — age, sex, weight, etc. to tailor expected ranges
- [ ] Profile-tailored expected ranges — age/sex/weight-aware ranges (either LOINC-ish dataset or a per-marker AI call grounded on profile)

## Later

## Ideas

## Questions

- Where do expected/reference ranges come from? Today: AI extracts them from each PDF (prompt tells model to leave null if missing). If we want profile-tailored ranges (age/sex/weight-aware), we need either a ranges dataset or a second AI call grounded on profile + marker.

## Done
