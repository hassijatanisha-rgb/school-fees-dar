// End-to-end tests: loads the real unpacked extension in Chromium and types real keystrokes.
// Run: node tests/run-tests.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const { stageExtension, launch } = require('./harness');
const { startServer } = require('./server');

const TEST_CONFIG = { storeId: '111', productId: '222', buyUrl: 'https://example.com/buy-snipkey' };
const results = [];
let currentGroup = '';

async function test(name, fn) {
  const label = `${currentGroup} > ${name}`;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`  PASS  ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ label, ok: false, error: e });
    console.log(`  FAIL  ${name}\n        ${String(e.stack || e).split('\n').slice(0, 4).join('\n        ')}`);
  }
}
function group(name) { currentGroup = name; console.log(`\n${name}`); }

const SHORT = 'Thank you! Let me know if you have any questions.';

async function main() {
  const { server, origin } = await startServer();
  const dir = stageExtension(TEST_CONFIG);
  const { context, sw, extId } = await launch(dir);
  const extUrl = (p) => `chrome-extension://${extId}/${p}`;

  const getLocal = () => sw.evaluate(async () => (await chrome.storage.local.get('snippets')).snippets);
  const addDirect = (items) => sw.evaluate(async (its) => {
    const l = await getSnippets();
    for (const i of its) l.push(makeSnippet(i));
    await chrome.storage.local.set({ snippets: l });
  }, items);
  const resetToExamples = () => sw.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await seedExamplesIfEmpty();
  });
  const setPro = (on) => sw.evaluate(async (v) => {
    if (v) await chrome.storage.sync.set({ license: { key: 'TEST-KEY', instanceId: 'test-instance', checkedAt: Date.now() } });
    else await chrome.storage.sync.remove('license');
  }, on);

  async function fieldsPage() {
    const page = await context.newPage();
    await page.goto(`${origin}/fields.html`);
    await page.waitForTimeout(300); // content script loads snippets + Pro status
    return page;
  }
  async function typeIn(page, sel, text) {
    await page.click(sel);
    await page.keyboard.type(text);
    await page.waitForTimeout(60);
  }
  const ceText = (page) => page.$eval('#ce', (e) => e.innerText.replace(/\u00a0/g, ' ')); // typed trailing spaces become nbsp

  // ------------------------------------------------------------------
  group('Install');
  await test('first install seeds 3 example snippets', async () => {
    const list = await getLocal();
    assert.deepStrictEqual(list.map((s) => s.shortcut), [';ty', ';date', ';sig']);
    assert.strictEqual(list[0].text, SHORT);
  });

  // ------------------------------------------------------------------
  group('Expansion (Free)');
  let page = await fieldsPage();
  await test('plain <input>', async () => {
    await typeIn(page, '#plain', 'Hi ;ty');
    assert.strictEqual(await page.inputValue('#plain'), `Hi ${SHORT}`);
  });
  await test('type=search input', async () => {
    await typeIn(page, '#search', ';ty');
    assert.strictEqual(await page.inputValue('#search'), SHORT);
  });
  await test('<textarea> with multi-line snippet', async () => {
    await typeIn(page, '#area', 'x ;sig');
    assert.strictEqual(await page.inputValue('#area'), 'x Best regards,\nAlex Example\nExample Co. | alex@example.com');
  });
  await test('contenteditable div (single and multi-line)', async () => {
    await typeIn(page, '#ce', 'Hello ;ty ');
    assert.strictEqual(await ceText(page), `Hello ${SHORT} `);
    await page.keyboard.type(';sig');
    await page.waitForTimeout(60);
    assert.strictEqual(await ceText(page), `Hello ${SHORT} Best regards,\nAlex Example\nExample Co. | alex@example.com`);
  });
  await test('React-style controlled input keeps the expanded value in its state', async () => {
    await typeIn(page, '#react', 'a ;ty');
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => reactState('react')), `a ${SHORT}`);
    assert.strictEqual(await page.inputValue('#react'), `a ${SHORT}`);
  });
  await test('React-style controlled type=email input (native setter + input event path)', async () => {
    await typeIn(page, '#reactEmail', ';ty');
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => reactState('reactEmail')), SHORT);
  });
  await test('password field is never expanded', async () => {
    await typeIn(page, '#pw', 'x;ty;sig');
    assert.strictEqual(await page.inputValue('#pw'), 'x;ty;sig');
  });
  await test('{date} placeholder', async () => {
    await page.fill('#plain', '');
    await typeIn(page, '#plain', ';date');
    const expected = await page.evaluate(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    assert.strictEqual(await page.inputValue('#plain'), expected);
  });
  await test('Ctrl+Z undoes an expansion back to the shortcut', async () => {
    await page.fill('#plain', '');
    await typeIn(page, '#plain', 'ok ;ty');
    assert.strictEqual(await page.inputValue('#plain'), `ok ${SHORT}`);
    await page.keyboard.press('Control+z');
    assert.strictEqual(await page.inputValue('#plain'), 'ok ;ty');
  });
  await test('Ctrl+Z in contenteditable restores the shortcut (single-line snippet)', async () => {
    await page.$eval('#ce', (e) => { e.textContent = ''; });
    await typeIn(page, '#ce', 'go ;ty');
    assert.strictEqual(await ceText(page), `go ${SHORT}`);
    await page.keyboard.press('Control+z');
    assert.strictEqual(await ceText(page), 'go ;ty');
  });
  await page.close();

  await addDirect([
    { shortcut: ';cur', text: 'Dear {cursor},\nThanks for {time} chat.' },
    { shortcut: 'brb', text: 'be right back' },
    { shortcut: ';clip', text: 'Pasted: {clipboard}!' },
    { shortcut: ';meet', text: 'Hi {input:Name}, does {input:Day} work? {cursor}Thanks!' },
  ]);
  page = await fieldsPage();
  await test('{cursor} in textarea: caret lands at the marker', async () => {
    await typeIn(page, '#area', ';cur');
    await page.keyboard.type('Sam');
    const v = await page.inputValue('#area');
    assert.match(v, /^Dear Sam,\nThanks for \d{1,2}:\d{2}( ?[AP]M)? chat\.$/);
  });
  await test('{cursor} in contenteditable', async () => {
    await typeIn(page, '#ce', ';cur');
    await page.keyboard.type('Kim');
    assert.match(await ceText(page), /^Dear Kim,\nThanks for .+ chat\.$/);
  });
  await test('letter-led shortcut only fires at a word boundary', async () => {
    await typeIn(page, '#plain', 'cobrb');
    assert.strictEqual(await page.inputValue('#plain'), 'cobrb');
    await page.keyboard.type(' brb');
    await page.waitForTimeout(60);
    assert.strictEqual(await page.inputValue('#plain'), 'cobrb be right back');
  });
  await test('Free: {input:...} fields expand as [Name] markers, no dialog', async () => {
    await page.fill('#plain', '');
    await typeIn(page, '#plain', ';meet');
    assert.strictEqual(await page.$('#snipkey-fill-host'), null);
    assert.strictEqual(await page.inputValue('#plain'), 'Hi [Name], does [Day] work? Thanks!');
  });
  await test('{clipboard} placeholder (extension clipboardRead permission only)', async () => {
    // Only the page's *write* permission is granted, so reading relies on the extension's clipboardRead.
    await context.grantPermissions(['clipboard-write'], { origin });
    await page.evaluate(() => navigator.clipboard.writeText('from-clipboard'));
    await page.fill('#plain', '');
    await typeIn(page, '#plain', ';clip');
    await page.waitForTimeout(200);
    const v = await page.inputValue('#plain');
    console.log(`        (clipboard result: ${JSON.stringify(v)})`);
    assert.strictEqual(v, 'Pasted: from-clipboard!');
  });
  await page.close();

  // ------------------------------------------------------------------
  group('Free limit (10 snippets)');
  await resetToExamples();
  await test('options page: add snippets up to 10, then the limit banner shows', async () => {
    const opt = await context.newPage();
    await opt.goto(extUrl('options.html'));
    for (let i = 4; i <= 10; i++) {
      await opt.click('#newBtn');
      await opt.fill('#edShortcut', `;s${i}`);
      await opt.fill('#edText', `Snippet number ${i}`);
      await opt.click('#edSave');
      await opt.waitForSelector('#edMsg.ok');
    }
    assert.strictEqual((await getLocal()).length, 10);
    await opt.waitForSelector('#limitBanner:not(.hidden)');
    assert.match(await opt.textContent('#limitBanner'), /reached the Free limit of 10/);
    await opt.click('#newBtn');
    assert.match(await opt.textContent('#edMsg'), /Pro/);
    await opt.close();
  });
  await test('popup: 11th snippet is refused with the upgrade prompt', async () => {
    const pop = await context.newPage();
    await pop.goto(extUrl('popup.html'));
    assert.match(await pop.textContent('#plan'), /Free · 10\/10/);
    await pop.fill('#addShortcut', ';s11');
    await pop.fill('#addText', 'eleven');
    await pop.click('#addBtn');
    await pop.waitForSelector('#addMsg.error');
    assert.match(await pop.textContent('#addMsg'), /Free includes up to 10 snippets/);
    assert.ok(await pop.isVisible('#upgrade'));
    assert.match(await pop.textContent('#getPro'), /Get Pro/);
    assert.strictEqual((await getLocal()).length, 10);
    await pop.close();
  });
  await test('Free: only the first 10 snippets expand (e.g. after a downgrade)', async () => {
    await addDirect([{ shortcut: ';s11', text: 'eleven' }]);
    const p = await fieldsPage();
    await typeIn(p, '#plain', ';s10 ;s11');
    assert.strictEqual(await p.inputValue('#plain'), 'Snippet number 10 ;s11');
    await p.close();
  });
  await test('Free: Pro features show the upgrade prompt (export, sync)', async () => {
    const opt = await context.newPage();
    await opt.goto(extUrl('options.html'));
    await opt.click('#exportBtn');
    assert.match(await opt.textContent('#ioMsg'), /Export is part of Snipkey Pro/);
    await opt.click('#syncToggle');
    assert.match(await opt.textContent('#syncMsg'), /Sync is part of Snipkey Pro/);
    assert.strictEqual(await opt.isChecked('#syncToggle'), false);
    assert.ok(await opt.isVisible('.lock'));
    await opt.close();
  });

  // ------------------------------------------------------------------
  group('Pro');
  await setPro(true);
  await addDirect([{ shortcut: ';meet', text: 'Hi {input:Name}, does {input:Day} work? {cursor}Thanks!' }]);
  page = await fieldsPage();
  await test('Pro: snippets beyond 10 expand', async () => {
    await typeIn(page, '#plain', ';s11');
    assert.strictEqual(await page.inputValue('#plain'), 'eleven');
  });
  await test('Pro: fill-in dialog in contenteditable, then caret at {cursor}', async () => {
    await typeIn(page, '#ce', 'Note: ;meet');
    await page.waitForSelector('#snipkey-fill-host >> input');
    await page.keyboard.type('Sam');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Tuesday');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#snipkey-fill-host', { state: 'detached' });
    await page.waitForTimeout(80);
    await page.keyboard.type('Cheers. ');
    assert.strictEqual(await ceText(page), 'Note: Hi Sam, does Tuesday work? Cheers. Thanks!');
  });
  await test('Pro: fill-in dialog in a React-style controlled input', async () => {
    await typeIn(page, '#react', ';meet');
    await page.waitForSelector('#snipkey-fill-host >> input');
    await page.keyboard.type('Ana');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Friday');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    assert.strictEqual(await page.evaluate(() => reactState('react')), 'Hi Ana, does Friday work? Thanks!');
  });
  await test('Pro: Esc cancels the dialog and leaves the shortcut', async () => {
    await typeIn(page, '#area', ';meet');
    await page.waitForSelector('#snipkey-fill-host >> input');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#snipkey-fill-host', { state: 'detached' });
    assert.strictEqual(await page.inputValue('#area'), ';meet');
  });
  await page.close();

  await test('Pro: popup allows more than 10 snippets', async () => {
    const pop = await context.newPage();
    await pop.goto(extUrl('popup.html'));
    await pop.waitForFunction(() => document.getElementById('plan').textContent === 'Pro');
    await pop.fill('#addShortcut', ';s13');
    await pop.fill('#addText', 'thirteen');
    await pop.click('#addBtn');
    await pop.waitForSelector('#addMsg.ok');
    assert.ok((await getLocal()).some((s) => s.shortcut === ';s13'));
    await pop.close();
  });

  const opt = await context.newPage();
  await opt.goto(extUrl('options.html'));
  await opt.waitForSelector('body.is-pro');
  await test('Pro: folders can be set and filtered', async () => {
    await opt.click('#list li:has(.chip:text-is(";s13"))');
    await opt.fill('#edFolder', 'Work');
    await opt.click('#edSave');
    await opt.waitForSelector('#edMsg.ok');
    await opt.selectOption('#folderFilter', 'Work');
    const shown = await opt.$$eval('#list li .chip', (els) => els.map((e) => e.textContent));
    assert.deepStrictEqual(shown, [';s13']);
    await opt.selectOption('#folderFilter', '');
  });
  await test('Pro: import CSV (header, quotes, commas, newlines)', async () => {
    const csv = 'shortcut,text\n;addr,"221B Baker Street, London"\n;multi,"Line one\nLine two ""quoted"""\n;ty,Thanks a lot!\nbad shortcut,x\n';
    await opt.setInputFiles('#importFile', { name: 'snips.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await opt.waitForSelector('#ioMsg:not(:empty)');
    const m = await opt.textContent('#ioMsg');
    assert.match(m, /Imported 2 new and updated 1 existing/);
    assert.match(m, /Skipped 1/);
    const list = await getLocal();
    assert.strictEqual(list.find((s) => s.shortcut === ';addr').text, '221B Baker Street, London');
    assert.strictEqual(list.find((s) => s.shortcut === ';multi').text, 'Line one\nLine two "quoted"');
    assert.strictEqual(list.find((s) => s.shortcut === ';ty').text, 'Thanks a lot!');
  });
  await test('Pro: export JSON, then re-import it (round trip)', async () => {
    const [dl] = await Promise.all([opt.waitForEvent('download'), opt.click('#exportBtn')]);
    const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    const local = await getLocal();
    assert.strictEqual(data.app, 'snipkey');
    assert.strictEqual(data.snippets.length, local.length);
    data.snippets.push({ shortcut: ';fromjson', text: 'json works', folder: 'Imported' });
    await opt.evaluate(() => { document.getElementById('ioMsg').textContent = ''; });
    await opt.setInputFiles('#importFile', { name: 'back.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await opt.waitForSelector('#ioMsg:not(:empty)');
    assert.match(await opt.textContent('#ioMsg'), new RegExp(`Imported 1 new and updated ${local.length} existing`));
  });
  await test('Pro: sync on writes chunks to chrome.storage.sync', async () => {
    await opt.click('#syncToggle');
    await opt.waitForSelector('#syncMsg.ok');
    const synced = await sw.evaluate(async () => (await readFromSync()).list.length);
    assert.strictEqual(synced, (await getLocal()).length);
  });
  await test('Pro: changes arriving from another device are pulled into this one', async () => {
    await sw.evaluate(async () => {
      const remote = (await readFromSync()).list;
      remote.push(makeSnippet({ shortcut: ';remote', text: 'from my laptop' }));
      await pushToSync(remote, Date.now() + 5000);
    });
    await new Promise((r) => setTimeout(r, 500));
    assert.ok((await getLocal()).some((s) => s.shortcut === ';remote'));
  });
  await test('Pro: over the sync quota -> saved locally, clear message', async () => {
    await opt.evaluate(() => { document.getElementById('ioMsg').textContent = ''; });
    const big = { snippets: [{ shortcut: ';huge', text: 'x'.repeat(120000) }] };
    await opt.setInputFiles('#importFile', { name: 'big.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(big)) });
    await opt.waitForSelector('#ioMsg:not(:empty)');
    assert.match(await opt.textContent('#ioMsg'), /larger than Chrome sync allows/);
    assert.ok((await getLocal()).some((s) => s.shortcut === ';huge'));
  });
  await opt.close();

  // ------------------------------------------------------------------
  group('Licence UI (fetch stubbed; real API never called)');
  await setPro(false);
  await test('wrong product key is rejected; right key activates; deactivate returns to Free', async () => {
    const lp = await context.newPage();
    lp.on('dialog', (d) => d.accept());
    await lp.goto(extUrl('options.html'));
    assert.strictEqual(await lp.textContent('#licStatus'), 'Free');
    await lp.evaluate(() => {
      window.__calls = [];
      window.fetch = async (url, opts) => {
        window.__calls.push(String(url));
        const body = new URLSearchParams(opts.body);
        const action = String(url).split('/').pop();
        const product = body.get('license_key') === 'GOOD-KEY' ? 222 : 999;
        const json = action === 'activate'
          ? { activated: true, instance: { id: 'inst-1' }, meta: { store_id: 111, product_id: product } }
          : { deactivated: true };
        return new Response(JSON.stringify(json), { status: 200 });
      };
    });
    await lp.fill('#licKey', 'OTHER-KEY');
    await lp.click('#licActivateBtn');
    await lp.waitForSelector('#licMsg.error');
    assert.match(await lp.textContent('#licMsg'), /different product/);
    await lp.fill('#licKey', 'GOOD-KEY');
    await lp.click('#licActivateBtn');
    await lp.waitForFunction(() => document.getElementById('licStatus').textContent === 'Pro');
    const lic = await sw.evaluate(async () => (await chrome.storage.sync.get('license')).license);
    assert.strictEqual(lic.instanceId, 'inst-1');
    await lp.click('#licDeactivateBtn');
    await lp.waitForFunction(() => document.getElementById('licStatus').textContent === 'Free');
    const calls = await lp.evaluate(() => window.__calls);
    assert.ok(calls.every((u) => u.startsWith('https://api.lemonsqueezy.com/v1/licenses/')));
    await lp.close();
  });

  await context.close();

  // ------------------------------------------------------------------
  group('Shipped build (empty config.js)');
  {
    const shipped = await launch(stageExtension(null));
    await test('options page says "Pro coming soon" and hides key entry', async () => {
      const p = await shipped.context.newPage();
      await p.goto(`chrome-extension://${shipped.extId}/options.html`);
      assert.ok(await p.isVisible('#licComingSoon'));
      assert.match(await p.textContent('#licComingSoon'), /Pro coming soon/);
      assert.ok(!(await p.isVisible('#licActivate')));
      assert.strictEqual(await p.textContent('#headerGetPro'), 'Pro coming soon');
      assert.ok(await p.isDisabled('#headerGetPro'));
    });
    await test('even with a stored licence, Pro stays off until config is filled in', async () => {
      await shipped.sw.evaluate(() => chrome.storage.sync.set({ license: { key: 'k', instanceId: 'i', checkedAt: Date.now() } }));
      assert.strictEqual(await shipped.sw.evaluate(() => isPro()), false);
    });
    await test('expansion works in the shipped build', async () => {
      const p = await shipped.context.newPage();
      await p.goto(`${origin}/fields.html`);
      await p.waitForTimeout(300);
      await p.click('#area');
      await p.keyboard.type(';ty');
      await p.waitForTimeout(60);
      assert.strictEqual(await p.inputValue('#area'), SHORT);
    });
    await shipped.context.close();
  }

  server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:\n' + failed.map((f) => `  - ${f.label}`).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
