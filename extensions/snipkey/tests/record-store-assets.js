// Produces the Chrome Web Store assets with the real extension:
//   store/screenshot-1-expand.png, store/screenshot-2-manager.png, store/screenshot-3-fill-in.png (1280x800)
//   store/demo.webm (~20 s, 1280x800)
// Run (headed under Xvfb gives a clean full-frame video):
//   HEADED=1 xvfb-run -a -s "-screen 0 1600x1200x24" node tests/record-store-assets.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stageExtension, launch } = require('./harness');
const { startServer } = require('./server');

const STORE = path.resolve(__dirname, '..', 'store');
const VIEW = { width: 1280, height: 800 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO_SNIPPETS = [
  { shortcut: ';ty', text: 'Thank you! Let me know if you have any questions.', folder: '' },
  { shortcut: ';date', text: '{date}', folder: '' },
  { shortcut: ';sig', text: 'Best regards,\nAlex Example\nExample Co. | alex@example.com', folder: '' },
  { shortcut: ';meet', text: 'Hi {input:Name}, are you free for a quick call on {input:Day}? {cursor}', folder: 'Sales' },
  { shortcut: ';addr', text: '42 Example Avenue, Springfield 01234', folder: 'Personal' },
  { shortcut: ';intro', text: 'Hi {input:Name},\n\nThanks for reaching out. {cursor}\n\nBest,\nAlex', folder: 'Sales' },
  { shortcut: ';refund', text: "I've issued a full refund. It should appear on your statement within 5–10 business days.", folder: 'Support' },
  { shortcut: ';hours', text: 'Our support team is available Monday to Friday, 9am–5pm.', folder: 'Support' },
  { shortcut: ';zoom', text: 'Here is the meeting link: https://example.com/meet/alex', folder: 'Sales' },
];

async function seed(sw, pro) {
  await sw.evaluate(async ({ items, pro: p }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ snippets: items.map(makeSnippet), snippetsUpdatedAt: Date.now() });
    if (p) await chrome.storage.sync.set({ license: { key: 'DEMO', instanceId: 'demo', checkedAt: Date.now() } });
  }, { items: DEMO_SNIPPETS, pro });
}

async function slowType(page, text, delay = 85) {
  await page.keyboard.type(text, { delay });
}

async function main() {
  fs.mkdirSync(STORE, { recursive: true });
  const { server, origin } = await startServer();
  // Fake licence IDs only so Pro screens can be shown; the licence API is never contacted.
  const dir = stageExtension({ storeId: '1', productId: '1', buyUrl: 'https://example.com/buy' });

  // ---------- screenshots ----------
  {
    const { context, sw, extId } = await launch(dir);
    await seed(sw, true);
    const page = await context.newPage();
    await page.setViewportSize(VIEW);

    // 1: expansion in a compose box
    await page.goto(`${origin}/demo.html?caption=${encodeURIComponent('Type <kbd>;ty</kbd> and get the whole sentence. In any text box.')}`);
    await page.waitForTimeout(400);
    await page.click('#to'); await page.keyboard.type('jordan@example.com');
    await page.click('#subject'); await page.keyboard.type('Your order');
    await page.click('#body');
    await page.keyboard.type('Hi Jordan,'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.keyboard.type('Your replacement ships today. ;ty'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.keyboard.type(';sig');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(STORE, 'screenshot-1-expand.png') });

    // 3: fill-in dialog (Pro)
    await page.goto(`${origin}/demo.html?caption=${encodeURIComponent('Pro: fill-in fields ask for names, dates and more')}`);
    await page.waitForTimeout(400);
    await page.click('#to'); await page.keyboard.type('sam@example.com');
    await page.click('#subject'); await page.keyboard.type('Quick call?');
    await page.click('#body');
    await page.keyboard.type(';meet');
    await page.waitForSelector('#snipkey-fill-host >> input');
    await page.keyboard.type('Sam');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Thursday');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(STORE, 'screenshot-3-fill-in.png') });
    await page.keyboard.press('Enter');

    // 2: snippet manager
    await page.goto(`chrome-extension://${extId}/options.html`);
    await page.waitForSelector('body.is-pro');
    await page.click('#list li:has(.chip:text-is(";intro"))');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(STORE, 'screenshot-2-manager.png') });
    await context.close();
  }

  // ---------- demo video ----------
  {
    const videoDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snipkey-video-'));
    const { context, sw } = await launch(dir, { recordVideo: { dir: videoDir, size: VIEW } });
    await seed(sw, true);
    const page = await context.newPage();
    for (const p of context.pages()) if (p !== page) await p.close(); // don't keep the start-up tab
    await page.setViewportSize(VIEW);
    await page.goto(`${origin}/demo.html?caption=${encodeURIComponent('Snipkey: type a shortcut, get the full text')}`);
    await page.waitForTimeout(1200);
    await page.click('#to'); await slowType(page, 'jordan@example.com', 45);
    await page.click('#subject'); await slowType(page, 'Your order', 60);
    await page.click('#body');
    await slowType(page, 'Hi Jordan,');
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.evaluate(() => setCaption('Type <kbd>;ty</kbd> …'));
    await slowType(page, 'Your replacement ships today. ', 55);
    await slowType(page, ';ty', 260);
    await page.evaluate(() => setCaption('… and it becomes the full sentence'));
    await page.waitForTimeout(2200);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.evaluate(() => setCaption('Pro: fill-in fields with <kbd>;meet</kbd>'));
    await slowType(page, ';meet', 260);
    await page.waitForSelector('#snipkey-fill-host >> input');
    await page.waitForTimeout(700);
    await slowType(page, 'Jordan', 110);
    await page.keyboard.press('Tab');
    await slowType(page, 'Thursday', 110);
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.evaluate(() => setCaption('Your signature: <kbd>;sig</kbd>'));
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await slowType(page, ';sig', 260);
    await page.waitForTimeout(1200);
    await page.evaluate(() => setCaption('Snipkey: private, fast, one-time Pro unlock'));
    await page.waitForTimeout(2200);
    const videoPath = await page.video().path();
    await context.close(); // finalises the video file
    const out = path.join(STORE, 'demo.webm');
    // Headed Chromium under Xvfb screencasts the 1280x800 page into a frame with a thin grey margin
    // (content ~1272x784). Trim it and scale back to exactly 1280x800 with Playwright's bundled ffmpeg.
    const ffmpeg = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
    if (process.env.HEADED && fs.existsSync(ffmpeg)) {
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', videoPath, '-vf', 'crop=1272:784:0:0,scale=1280:800', '-aspect', '1280:800',
        '-c:v', 'libvpx', '-b:v', '1500k', '-crf', '10', out]);
    } else fs.copyFileSync(videoPath, out);
    fs.rmSync(videoDir, { recursive: true, force: true });
  }

  server.close();
  console.log('Wrote:', fs.readdirSync(STORE).filter((f) => /\.(png|webm)$/.test(f)).join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
