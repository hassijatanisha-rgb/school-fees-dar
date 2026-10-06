# Chrome Web Store listing: Stitchly

## Name (31/45 chars)
Stitchly – Full Page Screenshot

## Short description (118/132 chars)
Capture an entire web page as one clean image in a click. No watermark, works on modern web apps, one-time Pro unlock.

## Category
Tools (alt: Productivity)

## Full description

Capture the whole page, top to bottom, in one click. Stitchly scrolls the page for you, stitches every part into one sharp image and opens it ready to download or paste. No watermark, ever.

WHY STITCHLY
• No watermark on any capture, Free or Pro.
• Works on modern web apps. When a page's real content sits inside a scrolling panel (dashboards, mail, docs, chat apps), Stitchly finds that panel and captures all of it, not just the visible screen.
• Sticky headers appear once. Fixed and sticky bars are shown at the top, hidden while scrolling, then put back, so they aren't repeated down the image. Chat bubbles and cookie bars that stick to the bottom appear once, at the bottom.
• Your page is left exactly as it was: Stitchly restores your scroll position when it finishes.
• Sharp on high-resolution screens (Retina/HiDPI).
• Very long pages are handled: when a page is taller than Chrome can hold in one image (16,384 px), Stitchly saves it as several images that join seamlessly and tells you so.
• One-time Pro unlock, no subscription.

HOW TO USE
1. Click the Stitchly icon in the toolbar, or press Alt+Shift+P.
2. Wait a moment while the page scrolls (the icon shows progress).
3. Your capture opens in a new tab. Click Download PNG or Copy.

FREE
• Full-page capture of any normal web page
• Correct capture of inner scrolling panels and sticky headers
• Download as PNG
• Copy to clipboard
• Zoom to preview long pages
• No watermark, no account, no limits

PRO: US$12 once, no subscription
• Download as PDF
• Annotate: boxes, arrows, text and blur/pixelate (hide emails, names or numbers), with undo
• Capture a selected region: drag a rectangle on the page (Alt+Shift+R or right-click the icon)
Pro features are visible with a small lock in the free version, so you can see what you get before you buy. Activate your licence key on the Stitchly options page.

PRIVACY
No data leaves your device except the licence check. Captures are made, stitched and stored in your browser only (the last 3 are kept so you can reopen them). There are no analytics, no tracking and no account. If you buy Pro, your licence key is checked with our payment provider, Lemon Squeezy, when you activate it and about once a week afterwards.

Note: Chrome doesn't allow any extension to capture its own pages (chrome:// pages, the New Tab page) or the Chrome Web Store. Stitchly shows a short explanation when you try.

---

## Single purpose (for the Privacy practices tab)
Stitchly captures the current web page as an image (full page or a selected region) and lets the user save, copy, annotate or export it as PDF.

## Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Gives Stitchly temporary access to the tab the user is on, only after the user clicks the toolbar icon, presses the shortcut or chooses the icon's menu item. Needed to take screenshots of that tab with `captureVisibleTab`. No access to any other tab or site. |
| `scripting` | Injects a small script into the active tab (only after the user's click/shortcut) to scroll the page, measure its height, find the scrolling panel, temporarily hide sticky/fixed headers, and restore the page afterwards. Also draws the region-selection overlay for Pro region capture. |
| `storage` | Stores the Pro licence status (`chrome.storage.sync`) so the user stays unlocked across browser restarts. No browsing data is stored. |
| `contextMenus` | Adds "Capture full page" and "Capture selected region" to the right-click menu of the Stitchly toolbar icon. |
| Host permission `https://api.lemonsqueezy.com/*` | Used only to activate, re-validate and deactivate a Pro licence key with Lemon Squeezy's licence API, when the user activates Pro (and a weekly re-check). No page content or browsing data is ever sent. |

## Remote code
No. All JavaScript is included in the package. No remote scripts, no `eval`.

## Data usage disclosures (Privacy practices tab)
- Personally identifiable information: No
- Health / Financial and payment / Authentication / Personal communications / Location / Web history / User activity / Website content: No (screenshots are processed locally and never transmitted)
- The only data sent off-device is the licence key the user enters, to Lemon Squeezy, to validate the purchase.
- Certify: not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used for creditworthiness or lending.

## Privacy policy URL
Host `store/PRIVACY.md` (e.g. as a GitHub Pages or website page) and paste its public URL.

## Store assets in this folder
- `screenshot-1-result.png`: 1280×800, result page showing a stitched long page (zoomed out)
- `screenshot-2-annotate.png`: 1280×800, annotation tools (box, arrow, text, blur)
- `screenshot-3-options.png`: 1280×800, options page with plan, licence key and Free vs Pro table
- `demo.webm`: about 25 s, 1280×800, capture → result → annotate → download (upload to YouTube for the listing's video field)
- `icon-512.png`: large icon render (the 128 px store icon is `icons/icon128.png` in the package)
