// Produces the Chrome Web Store screenshots (1280x800) and the demo video from the REAL
// extension pages, using the local demo page tests/pages/demo.html.
//   node tests/make-store-assets.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { buildVariant, launch, captureViaWorker, EXT_SRC } from './harness.mjs';

const STORE = path.join(EXT_SRC, 'store');
const { server, url: BASE } = await startServer();
const W = 1280;
const H = 800;
// Pro is shown with placeholder store/product IDs and a licence written straight into storage
// (no Lemon Squeezy call is made).
const proDir = buildVariant('assets', { config: { storeId: '1', productId: '2', buyUrl: 'https://example.test/buy' } });
const setPro = (page) => page.evaluate(() => chrome.storage.sync.set({ license: { key: 'DEMO', instanceId: 'demo', checkedAt: Date.now() } }));

// Fake mouse pointer so viewers can follow clicks in the video (Playwright doesn't draw one).
const CURSOR = () => {
  if (document.getElementById('__demo_cursor')) return;
  const c = document.createElement('div');
  c.id = '__demo_cursor';
  c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .05s';
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.5-8L21 10z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
  document.documentElement.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.left = `${e.clientX - 3}px`; c.style.top = `${e.clientY - 2}px`; }, true);
};

async function glide(page, x, y, steps = 15) { await page.mouse.move(x, y, { steps }); }
async function clickEl(page, sel) {
  const b = await page.locator(sel).boundingBox();
  await glide(page, b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
  await page.click(sel);
}
async function drag(page, tool, box, [x1, y1], [x2, y2]) {
  await clickEl(page, `.tool[data-tool=${tool}]`);
  await glide(page, box.x + x1, box.y + y1, 10);
  await page.mouse.down();
  await glide(page, box.x + x2, box.y + y2, 18);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function screenshots() {
  const ctx = await launch(proDir, { width: W, height: H });
  const opts = await ctx.context.newPage();
  await opts.goto(ctx.extUrl('options.html'));
  await opts.waitForFunction(() => document.body.dataset.ready);
  await opts.screenshot({ path: path.join(STORE, 'screenshot-3-options.png') });
  await setPro(opts);

  const page = await ctx.context.newPage();
  await page.goto(`${BASE}/demo.html`);
  const { resultPage: rp } = await captureViaWorker(ctx, page);
  for (let i = 0; i < 4; i++) await rp.click('#zoom-out'); // 25%
  await rp.waitForTimeout(300);
  await rp.screenshot({ path: path.join(STORE, 'screenshot-1-result.png') });

  for (let i = 0; i < 4; i++) await rp.click('#zoom-in'); // 100%
  await rp.click('#annotate');
  await rp.evaluate(() => window.scrollTo(0, 0));
  const box = await rp.locator('.frame canvas').first().boundingBox();
  await drag(rp, 'rect', box, [40, 150], [610, 330]);
  await drag(rp, 'arrow', box, [860, 300], [640, 230]);
  await rp.click('.swatch[data-color="#2563eb"]');
  await drag(rp, 'blur', box, [60, 448], [470, 510]);
  await rp.click('.swatch[data-color="#e11d48"]');
  await rp.click('.tool[data-tool=text]');
  await rp.mouse.click(box.x + 800, box.y + 330);
  await rp.keyboard.type('New headline!');
  await rp.keyboard.press('Enter');
  await rp.mouse.move(box.x + 1100, box.y + 600);
  await rp.waitForTimeout(300);
  await rp.screenshot({ path: path.join(STORE, 'screenshot-2-annotate.png') });
  await ctx.context.close();
}

async function video() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stitchly-video-'));
  const ctx = await launch(proDir, { width: W, height: H, recordVideo: { dir: tmp, size: { width: W, height: H } } });
  const opts = await ctx.context.newPage();
  await opts.goto(ctx.extUrl('options.html'));
  await setPro(opts);
  await opts.close();

  const page = await ctx.context.newPage();
  const t0 = Date.now();
  await page.goto(`${BASE}/demo.html`);
  await page.evaluate(CURSOR);
  await glide(page, 640, 400, 5);
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 900); await page.waitForTimeout(500);
  await page.mouse.wheel(0, -900); await page.waitForTimeout(400);
  // Caption (removed before capturing): the toolbar isn't part of a page recording.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__demo_caption';
    d.textContent = 'Click the Stitchly toolbar icon (or press Alt+Shift+P)';
    d.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2147483646;background:#0f766e;color:#fff;font:600 18px system-ui;padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    document.documentElement.appendChild(d);
  });
  await glide(page, 1180, 40, 20);
  await page.waitForTimeout(1000);
  // Remove the caption and the fake pointer so neither ends up in the capture.
  await page.evaluate(() => { document.getElementById('__demo_caption').remove(); document.getElementById('__demo_cursor').remove(); });
  const created = ctx.context.waitForEvent('page');
  const capture = captureViaWorker(ctx, page);
  const rp = await created;
  const demoEnd = (Date.now() - t0) / 1000;
  await capture;
  await rp.evaluate(CURSOR);
  await rp.mouse.move(640, 400);
  await rp.waitForTimeout(600);
  await clickEl(rp, '#zoom-out'); await rp.waitForTimeout(250);
  await clickEl(rp, '#zoom-out'); await rp.waitForTimeout(250);
  await clickEl(rp, '#zoom-out'); await rp.waitForTimeout(250);
  await clickEl(rp, '#zoom-out'); await rp.waitForTimeout(1000);
  await clickEl(rp, '#zoom-in'); await clickEl(rp, '#zoom-in'); await clickEl(rp, '#zoom-in'); await clickEl(rp, '#zoom-in');
  await rp.waitForTimeout(300);
  await clickEl(rp, '#annotate');
  await rp.waitForTimeout(500);
  const box = await rp.locator('.frame canvas').first().boundingBox();
  await drag(rp, 'rect', box, [40, 150], [610, 330]);
  await drag(rp, 'arrow', box, [860, 300], [640, 230]);
  await drag(rp, 'blur', box, [60, 448], [470, 510]);
  await clickEl(rp, '.tool[data-tool=text]');
  await glide(rp, box.x + 800, box.y + 330);
  await rp.mouse.click(box.x + 800, box.y + 330);
  await rp.keyboard.type('New headline!', { delay: 60 });
  await rp.keyboard.press('Enter');
  await rp.waitForTimeout(500);
  await clickEl(rp, '#done');
  const dl = rp.waitForEvent('download');
  await clickEl(rp, '#download');
  await (await dl).saveAs(path.join(tmp, 'demo.png'));
  await rp.waitForTimeout(1000);
  const dl2 = rp.waitForEvent('download');
  await clickEl(rp, '#pdf');
  await (await dl2).saveAs(path.join(tmp, 'demo.pdf'));
  await rp.waitForTimeout(1300);

  const v1 = await page.video().path();
  const v2 = await rp.video().path();
  await ctx.context.close();
  const out = path.join(STORE, 'demo.webm');
  // Demo page up to the moment the result tab opened, then the result tab.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', v1, '-i', v2, '-filter_complex',
    `[0:v]trim=0:${demoEnd.toFixed(2)},setpts=PTS-STARTPTS,fps=25,scale=${W}:${H}[a];[1:v]setpts=PTS-STARTPTS,fps=25,scale=${W}:${H}[b];[a][b]concat=n=2:v=1[v]`,
    '-map', '[v]', '-c:v', 'libvpx', '-b:v', '2M', '-crf', '10', '-an', out]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'default=nw=1', out]).toString().trim().replace(/\n/g, ' ');
  console.log(`demo.webm: ${dur}`);
}

try {
  await screenshots();
  await video();
} finally {
  server.close();
}
for (const f of fs.readdirSync(STORE).filter((f) => f.endsWith('.png'))) {
  const b = fs.readFileSync(path.join(STORE, f));
  console.log(`${f}: ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
}
