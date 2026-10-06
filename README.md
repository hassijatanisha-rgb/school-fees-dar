# Risiti Rahisi

A free receipt and invoice maker for small businesses in Tanzania, in Swahili and English. Fill in the items, tap **Tuma kwa WhatsApp**, and the customer gets a clean receipt image. Every receipt carries a small "Imetengenezwa bure na Risiti Rahisi · <your site>" line, so each receipt sent advertises the app.

- No signup, no server, no running cost: three static files in `app/`.
- Data stays on the user's phone (localStorage).
- Works on any phone browser; on Android it shares the image straight into WhatsApp.

## Go live (one time, ~10 minutes, free)

1. Sign up at https://pages.cloudflare.com (or Netlify) with GitHub.
2. Create a project from this repo. Build command: none. Output directory: `app`.
3. Optional (~US$10/yr): buy a short domain and attach it. The footer on every receipt shows whatever address the site runs on.

## Getting users without selling

See `GROWTH.md`. Posting a status is the only thing you do.

## Making money (later, only once people use it)

Free stays free. Paid "Pro", roughly TZS 5,000/month, would add: own logo, no footer, customer list, backup of history. Don't build it until a few hundred businesses use the free version. Before charging, you'll need a way to take mobile-money payments, which usually means a registered business.

## Before launch

- Have a native speaker check the Swahili wording.
- Check that the name "Risiti Rahisi" isn't already taken in Tanzania (BRELA search) and that a domain is free.

## Other ideas explored

`replica/alternatives/`: a school-fee app and a field-service app. Both need selling, so they're parked.
