# Recon map: Zeraki Finance (Android/web)

Scope: school fee management only: fee structure → student balances → payments → receipts → reminders → reports. Not exams, attendance or timetables.
For: a side project we sell to private English-medium primary/secondary schools in Dar es Salaam, reached through personal connections (IST alumni network, teachers who substitute at several schools).
Date: 2026-10-06
Method: clean-room, public sources only. zeraki.app and the Tanzanian news sites are blocked from this build environment, so the evidence is from search-result summaries. Confirm screens against Zeraki's own site, its Play Store listing and a demo before the build.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | product page | https://www.zeraki.app/zeraki-finance | cashflow summary, pledges, receipting, expenses, bulk SMS, reports, on-site bursar training |
| 2 | company | https://www.techloy.com/kenyan-edtech-zeraki-closes-1-8m-seed-to-expand-across-africa/ | Kenyan, expanding across Africa |
| 3 | competitor (TZ) | https://dailynews.co.tz/airtel-money-digitises-school-fees-payment/ | Airtel Money School Pay |
| 4 | competitor (TZ) | https://ippmedia.co.tz/the-guardian/news/local-news/read/airtel-money-tanzania-partners-with-schools-to-digitize-school-fees-payment-2024-06-27-161316 | School Pay includes ERP, fees, student and accounting modules **free of charge** to schools |
| 5 | market note (TZ) | https://mctaba.com/learn/tanzania/school-fees-sme-payment-system-tanzania | reference number per student; PDF receipt by SMS/WhatsApp; bursars often have no desktop |
| 6 | market note (TZ) | https://kolonell.com/en/blog/school-fees-payment-app-dar-es-salaam-2026 | Dar-specific (not readable from here: re-check) |
| 7 | competitor (TZ) | https://anbpost.substack.com/p/200000-tanzanian-parents-now-track | Infotaaluma: full school system, parent app/SMS |
| 8 | analogue (KE) | https://www.safaricom.co.ke/images/Downloads/m-pesa-bill-manager-for-schools.pdf | what a telco fee product looks like |

## Core loop

The bursar knows, at any moment, who has paid and who hasn't, without matching WhatsApp screenshots and bank slips by hand. Parents get a receipt automatically and a polite reminder before the school has to chase them.

## Screens

| ID | screen | route | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Login | / | bursar/head/owner login | phone + OTP | error |
| S02 | Cashflow summary | /home | collected vs expected this term, by class | stat tiles, bar per class | start of term (empty), mid, end |
| S03 | Students | /students | list with balance, class, parent phone | table, search, filter "owing" | empty, filled |
| S04 | Student statement | /students/:id | invoices, payments, pledges, balance | timeline, share-PDF | in credit, owing |
| S05 | Import students | /students/import | Excel/CSV upload | file drop, column map, errors | errors, done |
| S06 | Fee structure | /fees | items per class per term (tuition, transport, meals, uniform), discounts, sibling discount | editable grid | draft, published |
| S07 | Term billing | /fees/bill | generate invoices for the term | preview, confirm | preview, done |
| S08 | Record payment (receipt) | /payments/new | cash/bank/manual mobile money | amount, method, ref, student picker | duplicate-ref warning |
| S09 | Unmatched payments | /payments/unmatched | auto-imported payments without a clear student | match suggestions | empty, filled |
| S10 | Payments list | /payments | all receipts | table, export | filled |
| S11 | Pledges | /pledges | parent promises to pay by a date | list, overdue flag | due, broken, kept |
| S12 | Reminders / bulk messages | /messages | SMS/WhatsApp to parents owing, by class | template, audience, preview, cost | draft, sent |
| S13 | Expenses | /expenses | school spending | table | could: skip at first |
| S14 | Reports | /reports | defaulters, collection by class, daily cash | tables, export Excel/PDF | filled |
| S15 | Parent pay page | public link per student | shows balance, pay by M-Pesa / Mixx / Airtel / bank | pay buttons, receipt | owing, paid |
| S16 | Settings & users | /settings | school details, logo, terms, users (bursar, head, owner) | forms | filled |

## Flows

```
F01 Start of term billing
    S06 set fees -> S07 generate invoices -> S12 send "fees for Term 1" message with S15 link
    happy path clicks: ~6
    edge: new students mid-term, sibling discount, scholarship, mid-term fee change

F02 Parent pays by mobile money (the money flow)
    S15 -> push prompt on parent's phone -> confirmed -> receipt SMS/WhatsApp -> S02 updates
    parent taps: ~3, bursar clicks: 0
    edge: parent pays from another person's phone, pays via bank, part payment, overpayment

F03 Payment made outside the app
    S08 record -> receipt sent -> S04 updated
    edge: same bank slip entered twice

F04 Chase defaulters
    S03 filter owing -> S12 reminder to that class/all owing -> S11 record pledges
    edge: parent has 3 kids, reminder must show the combined balance

F05 End of term report to owner
    S14 -> export PDF -> share on WhatsApp
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Money (TZS) display/input | — | negative = credit | everywhere |
| Balance pill | paid, part, owing, overdue | — | S03, S04 |
| Student picker | search by name, admission no, parent phone | — | S08, S09 |
| Message composer | SMS, WhatsApp | cost preview | S12 |
| Share PDF | statement, receipt, report | — | S04, S10, S14 |

## Inferred data model

```
School       id, name, logo, phone, terms (json), payout_account
User         id, school_id, phone, name, role (owner|head|bursar)
Guardian     id, school_id, name, phone, whatsapp
Student      id, school_id, admission_no, name, class, status, guardian_ids
FeeItem      id, school_id, class, term, name, amount, optional
Invoice      id, student_id, term, total, discount, status
Payment      id, school_id, student_id?, amount, method (mpesa|mixx|airtel|bank|cash), provider_ref (unique), payer_phone, received_at, matched_by (auto|manual)
Pledge       id, student_id, amount, due_at, status
Message      id, school_id, channel, audience_filter, body, sent_count, cost
             evidence: sources 1, 5; confidence: medium
```

Relationships: School 1-n Student/Guardian/User; Guardian n-n Student (siblings); Student 1-n Invoice/Payment/Pledge.

## Out of scope

- Exams, attendance, timetables, report cards: that's a full school system (Infotaaluma, Airtel's free ERP). Stay narrow.
- Zeraki's name, branding, copy.
- Holding parents' money ourselves. Payments go via a licensed aggregator straight to the school's account (we never touch the cash: much less regulation).

## Size

Screens 16, flows 5, entities 9.
Hard parts:
1. **Matching payments to students.** Use a reference number per student (admission no.) and parent-phone matching, plus a manual queue (S09).
2. **Mobile-money aggregator onboarding for each school.** Selcom / AzamPay / ClickPesa or similar; each school may need its own merchant account, so check requirements early.
3. **SMS/WhatsApp costs.** Pass them through or cap per plan.

Size: **M** for the MVP (F01, F03, F04 with manual payments + reminders). Add F02 (automatic mobile-money) as phase 2.
