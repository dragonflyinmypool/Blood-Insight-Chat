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
One-time onboarding fee covering white-label configuration, LIMS integration, and staff training.

### Monthly SaaS Subscription (Tiered by Active Patients)

| Tier | Active Patients / Month | Price (est.) |
|---|---|---|
| Starter | Up to 500 | TBD |
| Growth | 501 – 2,000 | TBD |
| Scale | 2,001 – 10,000 | TBD |
| Enterprise | 10,000+ | Custom |

Pricing per tier to be validated through sales conversations. Volume discounts and annual billing discounts are options to explore.

---

## Go-to-Market

1. **Direct outreach** to lab owners and medical directors at mid-size independent labs.
2. **Demo-first sales motion** — show a live, white-labeled demo environment in their branding.
3. **Pilot program** — offer a discounted or free 90-day pilot to the first few labs to build case studies.
4. **Referral network** — satisfied labs refer peers; small revenue-share or discount incentive.

---

## Open Questions / To Decide

- [ ] Exact pricing per tier
- [ ] Setup fee amount (flat vs. based on integration complexity)
- [ ] Which LIMS vendors to prioritize for first integrations
- [ ] Whether to offer a patient-facing free tier or keep it purely B2B
- [ ] Reminder email sending infrastructure (Resend, SendGrid, etc.)
- [ ] Data residency / HIPAA BAA requirements per lab
