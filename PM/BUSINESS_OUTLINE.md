# Blood Insight — Lab Partnership Business Outline

## What It Is

A white-label patient portal that gives blood test labs a branded, modern experience for their patients. Results flow in automatically from the lab's existing system, displayed as an interactive dashboard with trend tracking, plain-language explanations, and automated reminders for the next test.

---

## Target Customer

**Independent and mid-size blood test labs** (5–50 staff, not hospital-owned chains)

- **Decision makers:** Lab directors and operations managers
- **Pain points:** Patients receive a PDF and disappear; no follow-up mechanism; generic, unbranded result experience
- **Goal:** Increase return visit rates and patient retention without adding admin overhead

**Not targeting (yet):** Hospital systems, GP clinics, large national chains — procurement cycles are too slow for early validation.

---

## Core Value Proposition

| Problem for the lab | What we solve |
|---|---|
| Patients don't understand their results | Beautiful dashboard with plain-language explanations and reference ranges |
| No way to follow up with patients | Automated reminders for repeat and annual tests |
| Generic PDF experience loses patients | Fully white-labeled portal under the lab's brand |
| Patients don't track trends or return | Historical trend view makes patients want to monitor over time |
| Manual patient communication | Admin panel to manage patients and see engagement stats |
| PDF delivery is error-prone and manual | Direct LIS integration — results flow automatically via HL7/FHIR, no staff effort required |

---

## Product Features (V1 Pitch)

1. **Direct LIS Integration** — connects to the lab's existing Laboratory Information System (LIS) via HL7 or FHIR; results flow to patients automatically with zero staff effort
2. **White-label portal** — lab logo, brand colors, custom domain
3. **Biomarker dashboard** — trends over time, reference ranges, flagged results
4. **Patient reminders** — automated email (and later SMS) nudges for next test
5. **Lab admin panel** — invite patients, manage result delivery, view engagement
6. **Patient invite flow** — lab sends a branded link; patient self-registers securely
7. **PDF upload fallback** — manual or email-attached PDF upload as an onboarding shortcut while LIS integration is being configured

---

## Pricing

| Tier | Price | Active Patients | Key Inclusions |
|---|---|---|---|
| Starter | **$599 / mo** | Up to 300 | White-label branding, dashboard, email reminders |
| Growth | **$1,400 / mo** | Up to 1,000 | All above + custom domain, priority email support |
| Scale | **$2,800 / mo** | Unlimited | All above + onboarding, dedicated support, SLA |

**One-time setup fee:** $500–$1,500 for white-label configuration and onboarding (filters non-serious prospects and covers setup time).

### Pilot Offer
Paid pilot at **$299 flat for 60 days** — fully set up, real data, full feature access. Converts to standard monthly pricing at end of pilot. Paying from day one signals commitment and makes the full-price transition feel natural.

### Pricing Rationale
A returning patient is worth $150–$500+ per visit. If reminders drive 15% more repeat bookings across 500 active patients, the lab gains tens of thousands in annual revenue. At $1,400/mo the ROI is immediate. Healthcare software also carries a compliance and reliability premium — pricing below $500/mo signals a hobby project, not an enterprise tool.

---

## Go-to-Market

1. Identify 10–15 target labs via LinkedIn and Google Maps
2. Cold outreach to lab director / ops manager with a short demo video
3. Offer the paid pilot (one lab, fully set up, real patient data)
4. Collect feedback, build a case study, convert to full monthly pricing
5. Use the case study to accelerate the next 10 lab conversations

---

## What We Need to Build (Lab-Ready V1)

- [ ] White-label theming — logo, colors, custom domain per lab
- [ ] Lab admin dashboard — patient management, result delivery history, engagement stats
- [ ] Patient invite flow — lab sends branded invite link
- [ ] Automated reminder system — scheduled email nudges (SMS in V2)
- [ ] **LIS integration layer** — HL7 v2 / FHIR receiver to ingest structured result data directly from the lab's system (primary data path)
- [ ] PDF fallback — for labs not yet on a supported LIS, accept PDF via upload or auto-email attachment
- [ ] Setup and onboarding documentation for lab staff

---

## Open Questions to Validate

- Will labs pay independently, or expect this bundled with their existing LIS/LIMS software?
- Who manages patient invites — lab staff manually, or automated on result upload?
- HIPAA / data privacy compliance requirements (varies by country/state)
- Preferred patient communication channel — email, SMS, or in-app notification?
- Do labs want to own the patient data export, or is cloud storage acceptable?

---

## Revenue Model Summary

| Scenario | Monthly ARR |
|---|---|
| 5 Starter labs | ~$3,000 / mo — $36k ARR |
| 5 Growth labs | ~$7,000 / mo — $84k ARR |
| 3 Starter + 5 Growth + 2 Scale | ~$15,600 / mo — $187k ARR |

Setup fees add a meaningful one-time revenue layer on top of recurring MRR.

---

*Last updated: April 2026*
