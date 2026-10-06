# Risiti Rahisi

A free receipt and invoice maker for small businesses in Tanzania, in Swahili and English. Fill in the items, tap **Tuma kwa WhatsApp**, and the customer gets a clean receipt image. Free receipts carry a small "Imetengenezwa bure na Risiti Rahisi · <site>" footer, so every receipt sent advertises the app.

No signup, no server, no running cost. The whole site is the `docs/` folder.

| plan | price | what you get |
| --- | --- | --- |
| Free | TSh 0 | unlimited receipts and invoices, with the footer |
| Basic | TSh 10,000 / month | your logo, no footer |
| Pro | TSh 20,000 / month | Basic + customer list, today/month sales totals, Excel (CSV) export, backup and restore |

## 1. Go live (one time, ~10 minutes, free)

**Cloudflare Pages (recommended, keeps the code private):**
1. Sign up at https://pages.cloudflare.com, then *Create → Pages → Connect to Git*, and pick this repo.
2. Framework: *None*. Build command: leave empty. Output directory: `docs`.
3. Deploy. You get an address like `risiti-rahisi.pages.dev`; name the project `risiti-rahisi` to get that.
4. Optional: in the project, turn on *Web Analytics* (free, no cookies) to see visits.

**Or GitHub Pages:** this needs the repo to be public on a free account. *Settings → Pages → Deploy from a branch → main → /docs*.

## 2. Turn on payments (2 minutes)

On GitHub, open `docs/config.js`, click the pencil icon, and fill in:

```js
payNumber: '0712 345 678',   // the M-Pesa / Mixx / Airtel number customers pay to
payName: 'YOUR NAME',        // the name they see when paying
whatsapp: '0712 345 678',    // where they send the transaction ID
```

Commit, and the site updates itself. Until these are filled in, the app shows "paid plans coming soon".

## 3. When someone pays (about 1 minute)

1. A WhatsApp message arrives: "nimelipa … Namba ya muamala … Simu ya biashara …".
2. Check the money arrived in your mobile-money SMS.
3. Open `<your site>/admin.html`. The first time only, load your `risiti-private-key.json` file.
4. Enter their business phone, the plan and the months, then tap **Make unlock link** and **Send on WhatsApp**.
5. They tap the link and their plan is unlocked on their phone.

**Keep `risiti-private-key.json` safe and private.** Anyone with it can make free codes. It is not in this repo, and `.gitignore` blocks it. If you lose it, Claude can make a new key pair; old codes keep working until they expire, but new codes need the new key.

Unlock codes are signed (ECDSA). The app can check a code but can't make one, and each code is tied to one business phone with an end date.

## Before launch

- Have a native speaker check the Swahili wording.
- Check that "Risiti Rahisi" isn't already taken in Tanzania (BRELA search).
- Taking money for a service may require business registration and a TIN in Tanzania. Check before you earn much. This is not legal advice.

## Marketing

See `GROWTH.md`: ready-to-paste posts.

## Other ideas explored

`replica/alternatives/`: a school-fee app and a field-service app. Both need selling, so they're parked.
