# Backlog

## Now

## Next

- [ ] Upload multiple files at once
- [ ] Background upload — don't block the dialog while PDF is being processed (dialog auto closes when pdf is added and says pdf being uploadedd). Then user can navigate and do what they want. Next pannel show "PDF/s being uploaded" ...once complete "PDF Upload success" etc (change wording, add detail but this is the basic idea)
- [ ] Manual corrections — edit extracted results after upload


## Later (details needs to be hashed out)

- Duplicate-upload UX — backend already returns 409 on duplicate hash; make sure the UI surfaces that message clearly to the user
- Personal profile — age, sex, weight, etc. to tailor expected ranges

- [ ] Should be a seperate DB table with a list of tests and their description, expected range by age range and sex. Each time a new type of blood test is added by the user, a value gets added to this BD and its gets the ranges from AI and stores them in the DB.  The test description should be very easy for the user to understand and we will add it to the UI.
- [ ] Profile-tailored expected ranges — age/sex/weight-aware ranges (either LOINC-ish dataset or a per-marker AI call grounded on profile)
- [ ] Key markers — improve selection logic (canonical list, abnormal-first, or user-pinned — currently ranked by frequency)

## Ideas

Would be cool to have a feature where a user could talk to their own AI with the info provided. I am not talking about an API key (that more for advanced users). I can only think of an easy export of the data as mk or json file ... that they can drop into their AI. 

Need a way to limit chat with AI because thats costly. Also would be better to have a good model to interact with. (maybe for now just have a easy export where they can drop the file into AI or maybe if our software creates a url and then give them a prompt to paste into their ai)

## Questions

- Where do expected/reference ranges come from? Today: AI extracts them from each PDF (prompt tells model to leave null if missing). If we want profile-tailored ranges (age/sex/weight-aware), we need either a ranges dataset or a second AI call grounded on profile + marker.

## Done

- Dashboard v1 — needs-attention, trending-toward-boundary, key-markers sparklines, recent tests
