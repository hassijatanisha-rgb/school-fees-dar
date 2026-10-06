# School fees (Dar es Salaam): side project

A simple school-fee app for private schools in Dar: bursars see who has paid, parents get receipts and reminders automatically.

Goal: **US$200–300 a week (~US$11–13k a year) for ~1 hour a week** once running.

## The money math

Price per student per term, paid by the school (parents pay nothing extra):

| price per student per term | per student per year (3 terms) | students needed for ~US$12k/yr | ≈ schools of 300 students |
| --- | --- | --- | --- |
| TZS 3,000 | TZS 9,000 | ~3,500 | ~12 |
| TZS 5,000 | TZS 15,000 | ~2,100 | ~7 |

(Assumes roughly TZS 2,600 per US$. Check the current rate.) Mobile-money and SMS costs are passed through or capped.

## The honest risk

Airtel Money's School Pay gives schools a fees module **free** (source: replica/recon.md #4), and banks offer free fee collection too. So we must win on what the free options don't do:

- works with **every** network and bank, not one telco
- **automatic receipts and reminders in Swahili** so the bursar stops chasing
- **matching payments to students** without the WhatsApp-screenshot mess
- set up in an afternoon from the school's existing Excel sheet

If 5 bursars won't say "yes, I'd pay TZS X for that", we stop or switch (backup: `replica/alternatives/field-service/`).

## Plan

1. **Validate (before building much, ~2–3 hrs total).** Through your and your mum's connections, ask 5 bursars or owners:
   - How do you track who has paid today?
   - What wastes the most time at the start of term?
   - Do you use Airtel School Pay or a bank system? What's annoying about it?
   - Would you pay TZS 3,000–5,000 per student per term for this? Would you try it free for one term?
2. **MVP (built by Claude, ~a few weeks).** Excel import, fee structure, term invoices, record payments + receipts, balances, defaulters, SMS reminders. Manual payments only.
3. **Pilot with 1–2 schools free for one term.** Fix what hurts.
4. **Phase 2.** Mobile-money collection via an aggregator and auto-matching.
5. **Sell.** Warm intros first; then a commission-only agent (20–30% of year one) so your time stays ~1 hr/week.

## Replica steps

`recon` ✅ → architect → design → build → backend → test → diff → entrepreneur → brand → launch → deploy
(skills: https://github.com/Jakeschincariol/replica-skill)
