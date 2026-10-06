// Shared helpers: load the unpacked extension in Chromium via Playwright.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const PW = process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright';
const { chromium } = require(PW);

const EXT_DIR = path.resolve(__dirname, '..');
const SHIP_EXCLUDE = new Set(['store', 'tests', 'snipkey.zip', 'node_modules', '.DS_Store']);

// Copies the extension (what ships) to a temp dir. If testConfig is set, config.js is replaced with
// fake Lemon Squeezy IDs so Pro can be enabled locally (no real licence API is ever called).
function stageExtension(testConfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snipkey-ext-'));
  const copy = (src, dst) => {
    for (const name of fs.readdirSync(src)) {
      if (src === EXT_DIR && SHIP_EXCLUDE.has(name)) continue;
      const s = path.join(src, name);
      const d = path.join(dst, name);
      if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d); copy(s, d); } else fs.copyFileSync(s, d);
    }
  };
  copy(EXT_DIR, dir);
  if (testConfig) {
    fs.writeFileSync(path.join(dir, 'config.js'), `const LICENSE_CONFIG = ${JSON.stringify(testConfig)};\n`);
  }
  return dir;
}

async function launch(extDir, extra = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snipkey-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium', // new headless mode supports extensions
    headless: process.env.HEADED ? false : true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    ...extra,
  });
  // Never talk to the real licence server from tests.
  await context.route('https://api.lemonsqueezy.com/**', (route) => route.abort());
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  // wait until onInstalled seeded the examples
  for (let i = 0; i < 50; i++) {
    const ok = await sw.evaluate(async () => Array.isArray((await chrome.storage.local.get('snippets')).snippets));
    if (ok) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return { context, sw, extId, userDataDir };
}

module.exports = { chromium, stageExtension, launch, EXT_DIR };
