// End-to-end tests for Stitchly. Run:  node tests/run-tests.mjs
// Loads the real unpacked extension in Chromium (new headless) and captures local test pages.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { buildVariant, launch, captureViaWorker, check, failureCount } from './harness.mjs';

const { server, url: BASE } = await startServer();
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'stitchly-out-'));

// Runs inside the result page: decodes the position-marker column and finds runs of probe colours.
function analyze({ dpr, markerX, rowFrom, rowTo, valueOffset, probes }) {
  const parts = window.stitchlyResult.parts;
  const res = { width: parts[0].base.width, height: 0, parts: parts.length, partHeights: [], markerChecked: 0, markerBad: 0, firstBad: null, probes: {} };
  const runs = Object.fromEntries(probes.map((p) => [p.name, []]));
  let y0 = 0;
  for (const p of parts) {
    const c = p.base;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const H = c.height;
    if (markerX !== undefined) {
      const col = ctx.getImageData(Math.round(markerX * dpr), 0, 1, H).data;
      for (let r = 0; r < H; r++) {
        const Y = y0 + r;
        if (Y % dpr) continue;
        const cssY = Y / dpr;
        if (cssY < rowFrom || cssY >= rowTo) continue;
        const v = Math.round(col[r * 4] / 4) + 64 * Math.round(col[r * 4 + 1] / 4) + 4096 * Math.round(col[r * 4 + 2] / 4);
        res.markerChecked++;
        if (v !== cssY - valueOffset) { res.markerBad++; if (!res.firstBad) res.firstBad = { cssY, got: v, want: cssY - valueOffset }; }
      }
    }
    for (const pr of probes) {
      const col = ctx.getImageData(Math.round(pr.x * dpr), 0, 1, H).data;
      const list = runs[pr.name];
      for (let r = 0; r < H; r++) {
        const m = Math.abs(col[r * 4] - pr.rgb[0]) < 8 && Math.abs(col[r * 4 + 1] - pr.rgb[1]) < 8 && Math.abs(col[r * 4 + 2] - pr.rgb[2]) < 8;
        if (!m) continue;
        const Y = y0 + r;
        const last = list[list.length - 1];
        if (last && last[1] === Y) last[1] = Y + 1; else list.push([Y, Y + 1]);
      }
    }
    res.partHeights.push(H);
    y0 += H;
  }
  res.height = y0;
  for (const pr of probes) res.probes[pr.name] = runs[pr.name].map(([a, b]) => [a / dpr, b / dpr]);
  return res;
}

const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

async function testLongPage(ctx, dpr) {
  console.log(`\n== Long page with sticky header + fixed chat button (DPR ${dpr}) ==`);
  const page = await ctx.context.newPage();
  await page.goto(`${BASE}/long.html`);
  await page.evaluate(() => window.scrollTo(0, 1234));
  const before = await page.evaluate(() => ({ y: scrollY, h: document.documentElement.scrollHeight, chat: (() => { const r = document.getElementById('chat').getBoundingClientRect(); return r.left + r.width / 2; })() }));
  const t0 = Date.now();
  const { value, resultPage } = await captureViaWorker(ctx, page);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const a = await resultPage.evaluate(analyze, {
    dpr, markerX: 10, rowFrom: 64, rowTo: before.h, valueOffset: 0,
    probes: [{ name: 'header', x: 640, rgb: [255, 0, 170] }, { name: 'chat', x: before.chat, rgb: [0, 200, 83] }],
  });
  const after = await page.evaluate(() => scrollY);
  console.log(`  frames=${value.frames} time=${secs}s scroller=${value.info.scroller} content=${before.h}px image=${a.width}x${a.height}px parts=${a.parts}`);
  console.log(`  header runs (css px): ${JSON.stringify(a.probes.header)}  chat runs: ${JSON.stringify(a.probes.chat)}`);
  console.log(`  marker rows checked=${a.markerChecked} mismatched=${a.markerBad}${a.firstBad ? ` first=${JSON.stringify(a.firstBad)}` : ''}`);
  check(value.info.isDoc === true, 'document chosen as scroll container');
  check(near(a.height, before.h * dpr, dpr), 'stitched height == full content height', `${a.height} vs ${before.h * dpr}`);
  check(a.probes.header.length === 1 && near(a.probes.header[0][0], 0) && near(a.probes.header[0][1], 64), 'sticky header appears exactly once, at the top');
  check(a.probes.chat.length === 1 && a.probes.chat[0][0] > before.h - 800, 'fixed bottom button appears once, at the bottom');
  check(a.markerChecked > 5000 && a.markerBad === 0, 'every row stitched from the correct page position');
  check(after === 1234, 'original scroll position restored', `scrollY=${after}`);
  await page.close();
  return resultPage;
}

async function testAppPage(ctx, dpr) {
  console.log(`\n== Web app: body doesn't scroll, inner div does (DPR ${dpr}) ==`);
  const page = await ctx.context.newPage();
  await page.goto(`${BASE}/app.html`);
  await page.evaluate(() => { document.getElementById('content').scrollTop = 800; });
  const m = await page.evaluate(() => { const c = document.getElementById('content'); return { sh: c.scrollHeight, ch: c.clientHeight, top: c.getBoundingClientRect().top, left: c.getBoundingClientRect().left }; });
  const { value, resultPage } = await captureViaWorker(ctx, page);
  const expectH = 800 + (m.sh - m.ch);
  const a = await resultPage.evaluate(analyze, {
    dpr, markerX: m.left + 10, rowFrom: m.top, rowTo: m.top + m.sh, valueOffset: m.top,
    probes: [{ name: 'subbar', x: 700, rgb: [255, 212, 0] }, { name: 'topbar', x: 700, rgb: [30, 41, 59] }],
  });
  const after = await page.evaluate(() => ({ inner: document.getElementById('content').scrollTop, win: scrollY }));
  console.log(`  frames=${value.frames} scroller=${value.info.scroller} inner scrollHeight=${m.sh} image=${a.width}x${a.height}px (expected height ${expectH * dpr})`);
  console.log(`  sticky sub-bar runs: ${JSON.stringify(a.probes.subbar)}  app top bar runs: ${JSON.stringify(a.probes.topbar)}`);
  console.log(`  marker rows checked=${a.markerChecked} mismatched=${a.markerBad}${a.firstBad ? ` first=${JSON.stringify(a.firstBad)}` : ''}`);
  check(value.info.isDoc === false && value.info.scroller === 'div#content', 'inner scrolling div detected', value.info.scroller);
  check(near(a.height, expectH * dpr, dpr), 'stitched height == app chrome + full inner content', `${a.height} vs ${expectH * dpr}`);
  check(a.probes.subbar.length === 1 && near(a.probes.subbar[0][0], m.top + 200) && near(a.probes.subbar[0][1] - a.probes.subbar[0][0], 48), 'sticky sub-bar inside the scroller appears exactly once');
  check(a.probes.topbar.length === 1 && near(a.probes.topbar[0][1], 56), 'app top bar appears once');
  check(a.markerChecked > 4000 && a.markerBad === 0, 'every inner row stitched from the correct position');
  check(after.inner === 800 && after.win === 0, 'inner scroll position restored', JSON.stringify(after));
  await page.close();
  await resultPage.close();
}

async function testTallPage(ctx) {
  console.log('\n== Very tall page (20,000 px) is split under the 16,384 px canvas limit ==');
  const page = await ctx.context.newPage();
  await page.goto(`${BASE}/tall.html`);
  const { value, resultPage } = await captureViaWorker(ctx, page);
  const a = await resultPage.evaluate(analyze, { dpr: 1, markerX: 10, rowFrom: 0, rowTo: 20000, valueOffset: 0, probes: [] });
  const notice = await resultPage.locator('#notice').innerText();
  console.log(`  frames=${value.frames} parts=${a.parts} heights=${a.partHeights.join('+')} marker checked=${a.markerChecked} bad=${a.markerBad}`);
  console.log(`  notice: "${notice}"`);
  check(a.parts === 2 && a.partHeights.every((h) => h <= 16384), 'split into 2 images, each <= 16384 px');
  check(a.height === 20000 && a.markerBad === 0, 'parts join seamlessly to the full 20000 px');
  check(/saved as 2 images/.test(notice), 'result page tells the user it was split');
  await page.close();
  await resultPage.close();
}

async function testRestricted(ctx) {
  console.log('\n== Pages Chrome forbids ==');
  const page = await ctx.context.newPage();
  await page.goto('chrome://version');
  const { resultPage } = await captureViaWorker(ctx, page);
  const text = await resultPage.locator('.error-card').innerText();
  console.log(`  chrome://version -> "${text.split('\n')[0]}"`);
  check(/doesn't allow extensions to capture this page/.test(text), 'friendly message on chrome:// page');
  const reasons = await ctx.sw.evaluate(() => ['https://chromewebstore.google.com/detail/abc', 'https://chrome.google.com/webstore/detail/x', 'chrome://newtab/', 'https://example.com/'].map(restrictedReason));
  console.log(`  restrictedReason: ${JSON.stringify(reasons)}`);
  check(JSON.stringify(reasons) === '["store","store","browser",null]', 'Web Store and chrome:// URLs recognised');
  await page.close();
  await resultPage.close();
}

async function testFreeResultPage(ctx, resultPage) {
  console.log('\n== Free plan: result page ==');
  const st = await resultPage.evaluate(() => ({
    pro: window.stitchlyResult.pro,
    pdfLocked: document.getElementById('pdf').hasAttribute('data-locked') && !!document.querySelector('#pdf .lock'),
    annLocked: !!document.querySelector('#annotate .lock'),
  }));
  st.getPro = await resultPage.locator('#getpro').isVisible();
  check(!st.pro && st.pdfLocked && st.annLocked && st.getPro, 'PDF/Annotate show a lock and Get Pro is visible', JSON.stringify(st));
  await resultPage.click('#annotate');
  const dlg = await resultPage.evaluate(() => ({ open: document.getElementById('upsell').open, note: document.getElementById('up-note').textContent }));
  dlg.tools = await resultPage.locator('#tools').isVisible();
  check(dlg.open && !dlg.tools, 'Annotate opens the Pro dialog instead of the tools', dlg.note);
  await resultPage.keyboard.press('Escape');
  const pdfDl = resultPage.waitForEvent('download', { timeout: 1500 }).catch(() => null);
  await resultPage.click('#pdf');
  check(!(await pdfDl), 'PDF is not downloadable on Free');
  await resultPage.keyboard.press('Escape');

  const [dl] = await Promise.all([resultPage.waitForEvent('download'), resultPage.click('#download')]);
  const file = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(file);
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`  downloaded ${dl.suggestedFilename()} ${w}x${h}`);
  check(buf.subarray(1, 4).toString() === 'PNG' && h === 6064, 'Download PNG saves the full image');

  await resultPage.click('#copy');
  await resultPage.waitForFunction(() => /Copied|failed/.test(document.getElementById('toast').textContent));
  console.log(`  toast: "${await resultPage.locator('#toast').innerText()}"`);
  const clip = await resultPage.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType('image/png');
    const bmp = await createImageBitmap(blob);
    return { types: items[0].types, w: bmp.width, h: bmp.height };
  }).catch((e) => ({ error: String(e) }));
  console.log(`  clipboard: ${JSON.stringify(clip)}`);
  check(clip.h === 6064, 'Copy puts the PNG on the clipboard');
}

async function testFreeGating(ctx, page) {
  console.log('\n== Free plan: region capture + options ==');
  await page.bringToFront();
  const optsPromise = ctx.context.waitForEvent('page');
  await ctx.sw.evaluate(async () => { const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return self.stitchly.captureRegion(tab); });
  const opts = await optsPromise;
  await opts.waitForFunction(() => document.body.dataset.ready);
  const o = await opts.evaluate(() => ({ url: location.search, banner: document.getElementById('why').hidden ? '' : document.getElementById('why').textContent, soon: !document.getElementById('soon').hidden, keyDisabled: document.getElementById('key').disabled, status: document.getElementById('status').textContent }));
  console.log(`  ${JSON.stringify(o)}`);
  check(/Pro feature/.test(o.banner), 'region capture on Free opens options with a Pro explanation');
  check(o.soon && o.keyDisabled && o.status === 'Free', 'empty LICENSE_CONFIG shows "Pro coming soon" and disables activation');
  await opts.close();
}

async function testPro(ctx) {
  console.log('\n== Pro plan (fake IDs, stubbed fetch; no real Lemon Squeezy calls) ==');
  let realCalls = 0;
  await ctx.context.route('https://api.lemonsqueezy.com/**', (route) => { realCalls++; route.abort(); });
  const opts = await ctx.context.newPage();
  await opts.goto(ctx.extUrl('options.html'));
  await opts.waitForFunction(() => document.body.dataset.ready);
  await opts.evaluate(() => {
    window.__calls = [];
    window.fetch = async (url, init) => {
      const body = Object.fromEntries(new URLSearchParams(init.body));
      window.__calls.push({ url, body });
      let json;
      if (url.endsWith('/activate')) {
        if (body.license_key === 'BAD') json = { activated: false, error: 'license_key not found.' };
        else if (body.license_key === 'OTHER') json = { activated: true, instance: { id: 'i0' }, meta: { store_id: 1, product_id: 999 } };
        else json = { activated: true, instance: { id: 'inst-1' }, meta: { store_id: 1, product_id: 2 } };
      } else json = { deactivated: true };
      return new Response(JSON.stringify(json));
    };
  });
  check(await opts.evaluate(() => !document.getElementById('soon').hidden) === false, 'configured store hides "Pro coming soon"');
  for (const [key, expect] of [['BAD', /not found/], ['OTHER', /different product/]]) {
    await opts.fill('#key', key);
    await opts.click('#activate');
    await opts.waitForFunction(() => document.getElementById('msg').classList.contains('err'));
    const msg = await opts.locator('#msg').innerText();
    check(expect.test(msg), `rejects key "${key}"`, msg);
  }
  await opts.fill('#key', 'GOOD-KEY');
  await opts.click('#activate');
  await opts.waitForFunction(() => document.getElementById('status').textContent === 'Pro');
  const stored = await opts.evaluate(() => chrome.storage.sync.get('license'));
  check(stored.license && stored.license.instanceId === 'inst-1', 'valid key activates Pro and is stored', JSON.stringify(stored.license));

  const page = await ctx.context.newPage();
  await page.goto(`${BASE}/long.html`);
  const { resultPage: rp } = await captureViaWorker(ctx, page);
  const st = await rp.evaluate(() => ({ pro: window.stitchlyResult.pro, locks: document.querySelectorAll('.lock').length }));
  st.getPro = await rp.locator('#getpro').isVisible();
  check(!(await rp.locator('#tools').isVisible()), 'annotation toolbar hidden until Annotate is clicked');
  check(st.pro && st.locks === 0 && !st.getPro, 'Pro: no locks, no Get Pro button', JSON.stringify(st));

  await rp.click('#annotate');
  check(await rp.locator('#tools').isVisible(), 'Annotate shows the toolbar');
  const box = await rp.locator('.frame canvas').first().boundingBox();
  const at = (x, y) => [box.x + x, box.y + y];
  const drag = async (tool, [x1, y1], [x2, y2]) => {
    await rp.click(`.tool[data-tool=${tool}]`);
    await rp.mouse.move(...at(x1, y1)); await rp.mouse.down();
    await rp.mouse.move(...at((x1 + x2) / 2, (y1 + y2) / 2), { steps: 4 });
    await rp.mouse.move(...at(x2, y2), { steps: 4 }); await rp.mouse.up();
  };
  const px = (x, y) => rp.evaluate(([x, y]) => [...window.stitchlyResult.parts[0].canvas.getContext('2d').getImageData(x, y, 1, 1).data], [x, y]);
  await drag('rect', [300, 200], [600, 350]);
  const ratio = await rp.evaluate(() => { const c = window.stitchlyResult.parts[0].canvas; return c.width / c.getBoundingClientRect().width; });
  const edge = await px(Math.round(300 * ratio), Math.round(275 * ratio));
  await drag('arrow', [700, 400], [900, 300]);
  await drag('blur', [0, 100], [200, 400]);
  await rp.click('.tool[data-tool=text]');
  await rp.mouse.click(...at(320, 500));
  await rp.keyboard.type('Check this');
  await rp.keyboard.press('Enter');
  const shapes = await rp.evaluate(() => window.stitchlyResult.parts[0].shapes.map((s) => s.type));
  const text = await rp.evaluate(() => window.stitchlyResult.parts[0].shapes.at(-1).text);
  check(text === 'Check this', 'text tool keeps every typed character', JSON.stringify(text));
  // Pixelation: marker strip rows should no longer each have distinct colours.
  const blurred = await rp.evaluate(() => { const d = window.stitchlyResult.parts[0].canvas.getContext('2d').getImageData(10, 120, 1, 60).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add(d[i] + ',' + d[i + 1]); return set.size; });
  console.log(`  shapes=${JSON.stringify(shapes)} rect edge pixel=${edge} distinct colours in 60 blurred marker rows=${blurred}`);
  check(JSON.stringify(shapes) === '["rect","arrow","blur","text"]', 'rectangle, arrow, blur and text added');
  check(edge[0] > 200 && edge[1] < 60, 'rectangle drawn in red on the image');
  check(blurred <= 8, 'blur box pixelates the area');
  await rp.click('#undo');
  const afterUndo = await rp.evaluate(() => window.stitchlyResult.parts[0].shapes.length);
  check(afterUndo === 3, 'undo removes the last annotation');
  await rp.click('#done');

  const [dl] = await Promise.all([rp.waitForEvent('download'), rp.click('#pdf')]);
  const pdfFile = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(pdfFile);
  const info = execFileSync('pdfinfo', [pdfFile]).toString();
  const pages = /Pages:\s+(\d+)/.exec(info)[1];
  const size = /Page size:\s+(.*)/.exec(info)[1];
  console.log(`  ${dl.suggestedFilename()}: Pages ${pages}, Page size ${size}`);
  execFileSync('pdftoppm', ['-r', '20', '-png', '-singlefile', pdfFile, path.join(OUT, 'pdfpage')]);
  check(pages === '1' && fs.existsSync(path.join(OUT, 'pdfpage.png')), 'PDF is valid (pdfinfo + pdftoppm render it)');
  const pyCheck = execFileSync('python3', ['-c', `import pypdf,sys; r=pypdf.PdfReader(sys.argv[1]); p=r.pages[0]; print(len(r.pages), [x.name for x in p.images])`, pdfFile]).toString().trim();
  console.log(`  pypdf: ${pyCheck}`);

  const [png] = await Promise.all([rp.waitForEvent('download'), rp.click('#download')]);
  await png.saveAs(path.join(OUT, 'annotated.png'));
  check(fs.statSync(path.join(OUT, 'annotated.png')).size > 1000, 'annotated PNG downloads');

  console.log('  region capture: dragging 400x300 box on the page');
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 500));
  const pagePromise = ctx.context.waitForEvent('page');
  const { ret } = await captureViaWorker(ctx, page, 'captureRegion', { waitResult: false });
  await page.waitForTimeout(500);
  await page.mouse.move(0, 100); await page.mouse.down();
  await page.mouse.move(200, 250, { steps: 5 }); await page.mouse.move(400, 400, { steps: 5 }); await page.mouse.up();
  const [regionRet, rr] = await Promise.all([ret, pagePromise]);
  await rr.waitForFunction(() => document.body.dataset.ready);
  const reg = await rr.evaluate(analyze, { dpr: 1, markerX: 10, rowFrom: 0, rowTo: 300, valueOffset: -600, probes: [] });
  const overlayGone = await page.evaluate(() => !document.querySelector('[data-stitchly]'));
  console.log(`  region ${reg.width}x${reg.height}, marker rows ok ${reg.markerChecked - reg.markerBad}/${reg.markerChecked}`);
  check(regionRet && reg.width === 400 && reg.height === 300, 'region capture produces the selected 400x300 area');
  check(reg.markerBad === 0, 'region shows the right part of the page (no overlay captured)');
  check(overlayGone, 'selection overlay removed from the page');

  await opts.bringToFront();
  await opts.click('#deactivate');
  await opts.waitForFunction(() => document.getElementById('status').textContent === 'Free');
  const calls = await opts.evaluate(() => window.__calls.map((c) => c.url.split('/').pop()));
  const after = await opts.evaluate(() => chrome.storage.sync.get('license'));
  check(!after.license && calls.includes('deactivate'), 'Deactivate returns to Free', JSON.stringify(calls));
  check(realCalls === 0, 'no real requests to api.lemonsqueezy.com', `count=${realCalls}`);
}

try {
  // 1) Shipping config (empty LICENSE_CONFIG), DPR 1
  let ctx = await launch(buildVariant('free', { extraPermissions: ['clipboardRead'] }));
  const rp = await testLongPage(ctx, 1);
  await testFreeResultPage(ctx, rp);
  await testAppPage(ctx, 1);
  await testTallPage(ctx);
  await testRestricted(ctx);
  const p = await ctx.context.newPage();
  await p.goto(`${BASE}/long.html`);
  await testFreeGating(ctx, p);
  await ctx.context.close();

  // 2) HiDPI
  ctx = await launch(buildVariant('dpr2'), { dpr: 2 });
  await testLongPage(ctx, 2);
  await testAppPage(ctx, 2);
  await ctx.context.close();

  // 3) Pro with fake store/product IDs
  ctx = await launch(buildVariant('pro', { config: { storeId: '1', productId: '2', buyUrl: 'https://example.test/buy' } }));
  await testPro(ctx);
  await ctx.context.close();
} catch (e) {
  console.error(e);
  check(false, 'test run crashed');
} finally {
  server.close();
}
console.log(`\n${failureCount() === 0 ? 'ALL TESTS PASSED' : `${failureCount()} FAILURE(S)`}  (artifacts in ${OUT})`);
process.exit(failureCount() ? 1 : 0);
