# Chrome Web Store listing: Snipkey

## Name (23 / 45 characters)

Snipkey – Text Expander

## Short description (128 / 132 characters)

Type a shortcut, get the full text in any text box. A fast, private text expander with a one-time Pro unlock. No account needed.

## Category

Productivity (Workflow & Planning)

## Full description

Stop typing the same things over and over. With Snipkey you type a short shortcut like ;ty and it instantly becomes your full text: "Thank you! Let me know if you have any questions."

WHY PEOPLE USE SNIPKEY
• Save time on every email, chat and form. Replies, addresses, signatures, links and canned answers are a few keystrokes away.
• Works where you type: plain text boxes, text areas and rich-text editors such as webmail compose windows, chat and social message boxes, help desks and CRMs.
• Smart placeholders: {date} and {time} insert today's date and the time, {clipboard} pastes what you copied, and {cursor} puts the caret exactly where you want to keep typing.
• Private by design: your snippets stay in your browser. No account, no sign-up, no tracking.
• Pay once, not every month. Snipkey Free is fully usable. Pro is a one-time unlock, not a subscription.

HOW IT WORKS
1. Click the Snipkey icon and add a snippet: a shortcut (for example ;addr) and the text it should become.
2. Type the shortcut in any text box. Snipkey replaces it with your text.
3. Press Ctrl+Z if you want the shortcut back.
Tip: start shortcuts with a symbol such as ; so they never trigger by accident.

FREE
• Up to 10 snippets
• Works in inputs, text areas and rich text editors
• {date}, {time}, {clipboard} and {cursor} placeholders
• Search and quick add from the toolbar popup
• 3 example snippets to get you started

PRO: ONE-TIME US$19, NO SUBSCRIPTION
• Unlimited snippets
• Fill-in fields: add {input:Name} to a snippet and Snipkey asks for the name each time you use it. Great for personalised replies.
• Folders to keep snippets organised
• Import and export (JSON, plus simple CSV with shortcut,text columns)
• Sync your snippets across your Chrome browsers with Chrome's own sync
Buy once, enter your licence key in Snipkey's settings, done.

PRIVACY
Your snippets stay in your browser; nothing is collected. Snipkey has no servers, no analytics and no remote code. It only watches what you type for your own shortcuts, and it never reads or acts in password fields. The only network request Snipkey ever makes is the licence check with our payment provider (Lemon Squeezy) when you activate Pro, and an occasional re-check of that licence.

## Permission justifications

**Content script on all sites (`<all_urls>`, all frames)**
Snipkey's single purpose is to expand your shortcuts wherever you type, and people type on every kind of website (webmail, social networks, chat apps, help desks, internal tools). The content script listens only for typing in text fields. On each keystroke it compares the few characters before the caret with your own shortcut list (a precomputed lookup, no page scanning) and, on a match, replaces the shortcut with your snippet. It never reads the rest of the page, never sends page content anywhere, and ignores password fields. It runs in all frames because many editors (for example email compose windows) live inside iframes.

**storage**
Saves your snippets and settings in your own browser (chrome.storage.local), and, only if you turn on sync in Pro, in Chrome's own sync storage (chrome.storage.sync) so they appear on your other Chrome browsers. The Pro licence key is also stored there.

**clipboardRead**
Used only for the optional {clipboard} placeholder: when you expand a snippet that contains {clipboard}, Snipkey reads the clipboard text at that moment and inserts it. The clipboard is never read otherwise, and its contents are never stored or sent anywhere.

**Host permission: https://api.lemonsqueezy.com/***
Used only to activate, validate and deactivate a Snipkey Pro licence key with Lemon Squeezy, our payment provider. The request contains only the licence key and an installation ID. No snippet or browsing data is sent.

**Remote code**
None. All code is packaged with the extension.

## Data usage disclosures (Privacy practices tab)

- Does not collect or use: personally identifiable information, health, financial and payment information, authentication information, personal communications, location, web history, user activity, or website content.
- (The licence key the user enters is sent only to Lemon Squeezy to verify a purchase.)
- Certify: not sold to third parties; not used or transferred for purposes unrelated to the item's single purpose; not used to determine creditworthiness or for lending.

## Single purpose

Expand user-defined text shortcuts into longer text in text fields on web pages.

## Store assets in this folder

- screenshot-1-expand.png (1280×800): a shortcut expanding in an email-style compose box (local demo page)
- screenshot-2-manager.png (1280×800): the snippet manager (options page)
- screenshot-3-fill-in.png (1280×800): the Pro fill-in dialog
- demo.webm (1280×800, ~19 s): ;ty expanding, then a Pro fill-in snippet, then ;sig. Upload to YouTube if you want it as the listing video.
- Icon: ../icons/icon128.png
