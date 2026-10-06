// Shared helpers for the Stitchly Playwright tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const require = createRequire(import.meta.url);
export const { chromium } = require('/opt/node-tools/node_modules/playwright');

export const EXT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['tests', 'store', 'stitchly.zip', 'node_modules']);

/**
 * Copy the extension to a temp dir for testing.
 * allUrls: add "<all_urls>" host permission. In real use the toolbar click / shortcut grants
 *   activeTab; Playwright can't click the browser toolbar, so tests call the service worker's
 *   capture function directly and need an equivalent host grant.
 * extraPermissions: test-only permissions (e.g. clipboardRead to read back what Copy wrote).
 * config: optional LICENSE_CONFIG override (e.g. fake store/product IDs for Pro tests).
 */
export function buildVariant(name, { allUrls = true, config = null, extraPermissions = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `stitchly-${name}-`));
  fs.cpSync(EXT_SRC, dir, { recursive: true, filter: (src) => !SKIP.has(path.relative(EXT_SRC, src).split(path.sep)[0]) });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.permissions.push(...extraPermissions);
  if (allUrls) manifest.host_permissions = [...manifest.host_permissions, '<all_urls>'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  if (config) fs.writeFileSync(path.join(dir, 'config.js'), `const LICENSE_CONFIG = ${JSON.stringify(config)};\n`);
  return dir;
}

// The real window size is used (viewport: null) because captureVisibleTab grabs the actual
// window surface; Playwright's viewport emulation would make the page and the capture disagree.
export async function launch(extDir, { dpr = 1, headless = true, recordVideo, width = 1280, height = 800 } = {}) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitchly-profile-'));
  const context = await chromium.launchPersistentContext(userDir, {
    channel: 'chromium',
    headless,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    acceptDownloads: true,
    recordVideo,
    args: [
      `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`,
      `--window-size=${width},${height}`, `--force-device-scale-factor=${dpr}`,
    ],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  // Resize the window so the page area (innerWidth x innerHeight) is exactly width x height.
  const first = await context.newPage();
  await first.goto('data:text/html,<title>sizing</title>');
  const cdp = await context.newCDPSession(first);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  for (let i = 0; i < 3; i++) {
    const m = await first.evaluate(() => [outerWidth - innerWidth, outerHeight - innerHeight, innerWidth, innerHeight]);
    if (process.env.DEBUG_WIN) console.log('window', m);
    if (m[2] === width && m[3] === height) break;
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: width + m[0], height: height + m[1] } });
    await first.waitForTimeout(300);
  }
  await first.close();
  return { context, sw, extId, extUrl: (p) => `chrome-extension://${extId}/${p}` };
}

/** Bring `page` to front, then run the SW capture function against the active tab. */
export async function captureViaWorker(ctx, page, fn = 'captureFull', { waitResult = true } = {}) {
  await page.bringToFront();
  const resultPage = waitResult ? ctx.context.waitForEvent('page', { timeout: 120000 }) : null;
  const ret = ctx.sw.evaluate(async (name) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return self.stitchly[name](tab);
  }, fn);
  if (!waitResult) return { ret };
  const [value, rp] = await Promise.all([ret, resultPage]);
  await rp.waitForFunction(() => document.body.dataset.ready, null, { timeout: 60000 });
  return { value, resultPage: rp };
}

let failures = 0;
export function check(cond, label, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
}
export const failureCount = () => failures;
