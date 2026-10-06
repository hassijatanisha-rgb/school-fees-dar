# Launch: one sitting (~10 min)

The Chrome Web Store only lets a person create the first listing in its dashboard. After that, updates can be automated.

Download `extensions/stitchly/stitchly.zip`, `extensions/snipkey/snipkey.zip` and the PNGs in each `store/` folder. Then paste this into Claude in your logged-in browser:

> In chrome.google.com/webstore/devconsole, create two new items. For each: upload the zip from my Downloads, fill the Store listing (name, short and full description, category) and the Privacy practices tab (single purpose, permission justifications, data disclosures) by copying from the listing file, upload its screenshot PNGs, set the privacy policy URL, and submit for review. Ask me before paying for anything.
>
> 1. stitchly.zip: listing https://github.com/hassijatanisha-rgb/school-fees-dar/blob/main/extensions/stitchly/store/listing.md, privacy policy https://hassijatanisha-rgb.github.io/school-fees-dar/stitchly/privacy.html
> 2. snipkey.zip: listing https://github.com/hassijatanisha-rgb/school-fees-dar/blob/main/extensions/snipkey/store/listing.md, privacy policy https://hassijatanisha-rgb.github.io/school-fees-dar/snipkey/privacy.html

## Later: Pro sales

1. Lemon Squeezy: create the store and two products with licence keys enabled (Stitchly Pro US$12, Snipkey Pro US$19). Payouts via PayPal, linked to M-Pesa.
2. Put each product's store ID, product ID and checkout URL into that extension's `config.js`, rebuild the zip (`tests/package.sh`), and upload the new version.
