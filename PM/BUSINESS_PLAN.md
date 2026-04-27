# Blood Insight Chat — B2B Business Plan

## Target Market

Medium-size blood testing laboratories seeking to increase customer retention and differentiate their service offering.

---

## Value Proposition

### For the Laboratory
- **Customer retention:** Automated, personalized email reminders prompt patients to return for follow-up tests — directly driving repeat business.
- **White-label product:** Fully branded with the lab's logo, colors, and identity. Patients experience it as the lab's own platform.
- **Competitive differentiation:** Offer a modern, AI-powered patient experience that smaller labs can't match on their own.

### For the Lab's Patients
- View and track their biomarker results over time in a clean, easy-to-understand interface.
- Chat with an AI assistant grounded in their actual lab data.
- Receive timely reminders when results suggest a follow-up test is due, or when it's simply been long enough to retest.

---

## Key Features

| Feature | Description |
|---|---|
| White labeling | Lab's branding throughout — logo, colors, domain |
| System integration | Direct API/HL7 connection to lab's LIMS for accurate, real-time data (replaces PDF parsing) |
| Automated reminders | Email campaigns triggered by time elapsed or result-based recommendations |
| Patient portal | Biomarker history, trend charts, AI chat |
| Multi-lab support | Each lab gets its own isolated tenant |

---

## System Integration

Current PDF-based extraction is a fallback for labs without API access. The primary integration path is a direct connection to the lab's **Laboratory Information Management System (LIMS)**, giving patients 100% accurate data and removing the manual upload step entirely.

Supported integration targets (to be prioritized):
- HL7 FHIR APIs
- Lab-specific export formats / SFTP feeds
- Direct LIMS vendor partnerships

---

## Automated Reminder Logic

Reminders are sent based on:
1. **Time-based:** "It's been 6 months since your last panel — time to retest."
2. **Result-based:** Specific out-of-range markers trigger a recommendation for a targeted follow-up (e.g., flagged HbA1c → suggest 3-month recheck).

The lab controls reminder frequency, messaging tone, and which triggers are active.

---

## Pricing Model

### Setup Fee

| Integration Type | Fee |
|---|---|
| PDF upload only | $500 |
| LIMS integration | $2,500 – $5,000 (varies by vendor) |

### Monthly SaaS Subscription (Tiered by Active Patients)

| Tier | Active Patients / Month | Price |
|---|---|---|
| Starter | Up to 300 | $149 / mo |
| Growth | 301 – 1,500 | $399 / mo |
| Scale | 1,501 – 5,000 | $799 / mo |
| Enterprise | 5,000+ | Custom (~$1,500+) |

Annual billing: 2 months free (~15% discount). All tiers include white labeling and email reminders.

---

## Go-to-Market

1. **Direct outreach** to lab owners and medical directors at mid-size independent labs.
2. **Demo-first sales motion** — show a live, white-labeled demo environment in their branding.
3. **Pilot program** — offer a discounted or free 90-day pilot to the first few labs to build case studies.
4. **Referral network** — satisfied labs refer peers; small revenue-share or discount incentive.

---

## Next Steps

1. Pull mid-size independent lab list from CMS CLIA database
2. Define target region for initial outreach cohort (~50 labs)
3. Build white-labeled demo environment
4. Reach out to first 10 labs — aim for 1–2 paid pilots

---

## Open Questions

- HIPAA BAA + data ownership agreement per lab
- Patient consent flow
- Which LIMS vendors to integrate first
- Who handles LIMS integration work (us vs. contractor)
- Sales cycle owner — who closes the deal?
- Competitive landscape — what do labs already use?
- Breakeven model — how many labs needed at each tier?
