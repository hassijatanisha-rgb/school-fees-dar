# Launch: one sitting (~10 min)

The Chrome Web Store only lets a person create the first listing in its dashboard. After that, updates can be automated.

Download `extensions/stitchly/stitchly.zip`, `extensions/snipkey/snipkey.zip` and the PNGs in each `store/` folder. Then paste this into Claude in your logged-in browser:

> In chrome.google.com/webstore/devconsole, create two new items. For each: upload the zip from my Downloads, fill the Store listing (name, short and full description, category) and the Privacy practices tab (single purpose, permission justifications, data disclosures) by copying from the listing file, upload its screenshot PNGs, set the privacy policy URL, and submit for review. Ask me before paying for anything.
>
> 1. stitchly.zip: listing https://github.com/hassijatanisha-rgb/school-fees-dar/blob/main/extensions/stitchly/store/listing.md, privacy policy https://hassijatanisha-rgb.github.io/school-fees-dar/stitchly/privacy.html
> 2. snipkey.zip: listing https://github.com/hassijatanisha-rgb/school-fees-dar/blob/main/extensions/snipkey/store/listing.md, privacy policy https://hassijatanisha-rgb.github.io/school-fees-dar/snipkey/privacy.html

## After the listings exist: paste this into Codex once

This turns on Pro sales and automatic updates. After it, new versions publish themselves when the version number changes.

> 1. In Lemon Squeezy (app.lemonsqueezy.com), create a store if there isn't one, with payouts to my PayPal. Create two products with licence keys enabled: "Stitchly Pro" for US$12 one-time, and "Snipkey Pro" for US$19 one-time. Note the store ID, each product ID and each product's checkout URL.
> 2. In Google Cloud console, create a project, enable the "Chrome Web Store API", create a service account, and download a JSON key for it. In the Chrome Web Store developer dashboard, add that service account's email so it can publish my items, and note my publisher ID and the item IDs of Stitchly and Snipkey.
> 3. In GitHub, repo hassijatanisha-rgb/school-fees-dar -> Settings -> Secrets and variables -> Actions: add the secret CWS_SERVICE_ACCOUNT_JSON (the whole JSON key), and the variables CWS_PUBLISHER_ID, STITCHLY_ITEM_ID, SNIPKEY_ITEM_ID, LS_STORE_ID, STITCHLY_LS_PRODUCT_ID, STITCHLY_BUY_URL, SNIPKEY_LS_PRODUCT_ID, SNIPKEY_BUY_URL.
> 4. In the Actions tab, run the "Publish extensions" workflow once and tell me if it fails. Ask me before paying for anything.

How it works: `.github/workflows/publish-extensions.yml` writes the Lemon Squeezy IDs into each `config.js`, packages the zip and uploads and publishes it through the Chrome Web Store API v2. An extension without its item ID is skipped.
