'use strict';

const $ = (id) => document.getElementById(id);
let pro = false;
let all = [];
let editingId = null; // null = nothing, '' = new snippet

function msg(id, text, kind = 'error') {
  const el = $(id);
  el.textContent = '';
  el.className = `msg ${kind}`;
  if (text) el.append(text);
}

function proMsg(id, feature) {
  const el = $(id);
  msg(id, `${feature} is part of Snipkey Pro (one-time US$19). `, 'warn');
  el.appendChild(getProButton());
}

function getProButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pro-btn';
  if (proOnSale()) {
    b.textContent = 'Get Pro';
    b.addEventListener('click', openBuyPage);
  } else {
    b.textContent = 'Pro coming soon';
    b.disabled = true;
  }
  return b;
}

// ---------- list ----------

function folders() {
  return [...new Set(all.map((s) => s.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const folder = pro ? $('folderFilter').value : '';
  const list = $('list');
  list.textContent = '';
  const shown = all.filter((s) => (!folder || s.folder === folder)
    && (!q || s.shortcut.toLowerCase().includes(q) || s.text.toLowerCase().includes(q) || (s.folder || '').toLowerCase().includes(q)));
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'group';
    li.textContent = all.length ? 'No snippets match' : 'No snippets yet';
    list.appendChild(li);
  }
  shown.forEach((s) => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    if (s.id === editingId) li.classList.add('selected');
    if (!pro && all.indexOf(s) >= FREE_LIMIT) {
      li.classList.add('inactive');
      li.title = 'Inactive on Free: only your first 10 snippets expand. Get Pro for unlimited.';
    }
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = s.shortcut;
    const prev = document.createElement('span');
    prev.className = 'preview';
    prev.textContent = s.text.replace(/\s+/g, ' ');
    li.append(chip, prev);
    if (s.folder) {
      const f = document.createElement('span');
      f.className = 'folder';
      f.textContent = s.folder;
      li.appendChild(f);
    }
    li.addEventListener('click', () => openEditor(s.id));
    list.appendChild(li);
  });

  const sel = $('folderFilter');
  const current = sel.value;
  sel.textContent = '';
  sel.append(new Option('All folders', ''));
  folders().forEach((f) => sel.append(new Option(f, f)));
  sel.value = folders().includes(current) ? current : '';
  sel.disabled = !pro;
  $('folderList').textContent = '';
  folders().forEach((f) => $('folderList').append(new Option(f)));

  $('count').textContent = pro ? `(${all.length})` : `(${all.length} of ${FREE_LIMIT} on Free)`;
  const banner = $('limitBanner');
  if (!pro && all.length >= FREE_LIMIT) {
    banner.classList.remove('hidden');
    banner.textContent = all.length > FREE_LIMIT
      ? `You have ${all.length} snippets; Free expands the first ${FREE_LIMIT}. `
      : `You've reached the Free limit of ${FREE_LIMIT} snippets. Get Pro for unlimited snippets, fill-in fields, folders, import/export and sync. `;
    banner.appendChild(getProButton());
  } else banner.classList.add('hidden');
}

// ---------- editor ----------

function openEditor(id) {
  const s = all.find((x) => x.id === id);
  editingId = s ? s.id : '';
  $('editor').classList.remove('hidden');
  $('editorEmpty').classList.add('hidden');
  $('editorTitle').textContent = s ? `Edit ${s.shortcut}` : 'New snippet';
  $('edShortcut').value = s ? s.shortcut : '';
  $('edFolder').value = s ? s.folder || '' : '';
  $('edFolder').disabled = !pro;
  $('edFolder').placeholder = pro ? 'e.g. Support' : 'Folders are a Pro feature';
  $('edText').value = s ? s.text : '';
  $('edDelete').classList.toggle('hidden', !s);
  msg('edMsg', '');
  renderList();
  (s ? $('edText') : $('edShortcut')).focus();
}

function closeEditor() {
  editingId = null;
  $('editor').classList.add('hidden');
  $('editorEmpty').classList.remove('hidden');
  renderList();
}

$('newBtn').addEventListener('click', () => {
  if (!pro && all.length >= FREE_LIMIT) {
    openEditor('');
    proMsg('edMsg', 'More than 10 snippets');
    return;
  }
  openEditor('');
});
$('edCancel').addEventListener('click', closeEditor);

$('editor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = { shortcut: $('edShortcut').value, text: $('edText').value };
  if (pro) data.folder = $('edFolder').value.trim();
  try {
    const res = editingId ? await updateSnippet(editingId, data) : await addSnippet(data);
    await load();
    openEditor(res.snippet.id);
    if (res.syncError) msg('edMsg', `Saved on this device. ${res.syncError}`, 'warn');
    else if (!pro && /\{input:/.test(data.text)) msg('edMsg', 'Saved. Fill-in fields are a Pro feature; on Free they expand as [Name] markers.', 'warn');
    else msg('edMsg', 'Saved.', 'ok');
  } catch (err) {
    if (err.code === 'limit') proMsg('edMsg', 'More than 10 snippets');
    else msg('edMsg', err.message || String(err));
  }
});

$('edDelete').addEventListener('click', async () => {
  if (!editingId) return;
  const s = all.find((x) => x.id === editingId);
  if (!s || !confirm(`Delete ${s.shortcut}?`)) return;
  await deleteSnippet(editingId);
  await load();
  closeEditor();
});

document.querySelectorAll('.tokens button').forEach((b) => b.addEventListener('click', () => {
  const token = b.dataset.token;
  if (token.startsWith('{input:') && !pro) { proMsg('edMsg', 'Fill-in fields'); return; }
  const ta = $('edText');
  const { selectionStart: a, selectionEnd: z } = ta;
  ta.setRangeText(token, a, z, 'end');
  if (token === '{input:Name}') ta.setSelectionRange(a + 7, a + 11); // select "Name" so it can be renamed
  ta.focus();
}));

$('search').addEventListener('input', renderList);
$('folderFilter').addEventListener('change', renderList);
document.querySelector('.folder-filter').addEventListener('click', () => { if (!pro) proMsg('edMsg', 'Folders'); });

// ---------- import / export ----------

$('exportBtn').addEventListener('click', async () => {
  if (!pro) { proMsg('ioMsg', 'Export'); return; }
  const blob = new Blob([exportJson(await getSnippets())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `snipkey-snippets-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  msg('ioMsg', 'Exported.', 'ok');
});

$('importLabel').addEventListener('click', (e) => {
  if (!pro) { e.preventDefault(); proMsg('ioMsg', 'Import'); }
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !pro) return;
  try {
    const { items, errors } = parseImport(await file.text(), file.name);
    if (!items.length) { msg('ioMsg', errors.length ? `Nothing imported. ${errors.slice(0, 3).join(' ')}` : 'No snippets found in that file.'); return; }
    const res = await importSnippets(items);
    await load();
    let text = `Imported ${res.added} new and updated ${res.replaced} existing snippet(s).`;
    if (errors.length) text += ` Skipped ${errors.length}: ${errors.slice(0, 3).join(' ')}`;
    if (res.syncError) text += ` ${res.syncError}`;
    msg('ioMsg', text, errors.length || res.syncError ? 'warn' : 'ok');
  } catch (err) {
    msg('ioMsg', err.message || String(err));
  }
});

// ---------- sync ----------

$('syncToggle').addEventListener('click', async (e) => {
  if (!pro) { e.preventDefault(); proMsg('syncMsg', 'Sync'); return; }
  const on = e.target.checked;
  try {
    if (on) {
      const res = await enableSync();
      await load();
      if (res.syncError) msg('syncMsg', res.syncError, 'warn');
      else msg('syncMsg', 'Sync is on. Snippets will appear on other Chrome browsers signed in to the same account with Snipkey Pro and sync turned on.', 'ok');
    } else {
      await disableSync();
      msg('syncMsg', 'Sync is off. Snippets stay on this device.', 'ok');
    }
  } catch (err) {
    e.target.checked = !on;
    msg('syncMsg', err.message || String(err));
  }
});

// ---------- licence ----------

async function renderLicense() {
  const configured = licenseConfigured();
  $('licStatus').textContent = pro ? 'Pro' : 'Free';
  $('licComingSoon').classList.toggle('hidden', configured);
  $('licActivate').classList.toggle('hidden', pro || !configured);
  $('licActive').classList.toggle('hidden', !pro);
  $('headerGetPro').textContent = proOnSale() ? 'Get Pro · US$19 once' : 'Pro coming soon';
  $('headerGetPro').disabled = !proOnSale();
}

$('headerGetPro').addEventListener('click', openBuyPage);

$('licActivateBtn').addEventListener('click', async () => {
  const key = $('licKey').value.trim();
  if (!key) { msg('licMsg', 'Paste your licence key first.'); return; }
  $('licActivateBtn').disabled = true;
  msg('licMsg', 'Activating…', 'ok');
  const res = await activateLicense(key);
  $('licActivateBtn').disabled = false;
  if (res.ok) { $('licKey').value = ''; await load(); msg('licMsg', 'Pro activated. Enjoy unlimited snippets!', 'ok'); } else msg('licMsg', res.error);
});

$('licDeactivateBtn').addEventListener('click', async () => {
  if (!confirm('Deactivate Pro on this browser? You can activate the same key again later.')) return;
  await deactivateLicense();
  await disableSync();
  await load();
  msg('licMsg', 'Pro deactivated on this browser.', 'ok');
});

// ---------- boot ----------

async function load() {
  [pro, all] = await Promise.all([getProStatus(), getSnippets()]);
  document.body.classList.toggle('is-pro', pro);
  $('plan').textContent = pro ? 'Pro' : 'Free';
  $('plan').classList.toggle('pro', pro);
  const settings = await getSettings();
  $('syncToggle').checked = pro && settings.syncEnabled;
  if (pro && settings.syncEnabled && settings.syncError) msg('syncMsg', settings.syncError, 'warn');
  document.querySelectorAll('.pro-gated').forEach((el) => el.classList.toggle('disabled', !pro));
  if (editingId && !all.some((s) => s.id === editingId)) closeEditor();
  renderList();
  renderLicense();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local' && changes.snippets) || (area === 'sync' && changes.license)) load();
});

load().then(() => {
  const m = location.hash.match(/^#edit=(.+)$/);
  if (m) openEditor(decodeURIComponent(m[1]));
  else if (location.hash === '#new') openEditor('');
});
