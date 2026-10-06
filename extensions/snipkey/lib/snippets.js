// Snipkey data layer, shared by the background worker, popup and options page.
// Snippets always live in chrome.storage.local (what the content script reads).
// Pro users can turn on sync: the list is then mirrored to chrome.storage.sync in chunks.
'use strict';

const FREE_LIMIT = 10;
const SHORTCUT_MAX = 32;
const SYNC_PREFIX = 'snipsync_';
const SYNC_META = 'snipsync_meta';
// chrome.storage.sync limits: 102,400 bytes total, 8,192 bytes per item. Leave room for the licence.
const SYNC_TOTAL_BUDGET = 100000;
const SYNC_ITEM_BUDGET = 7800;

const EXAMPLE_SNIPPETS = [
  { shortcut: ';ty', text: 'Thank you! Let me know if you have any questions.', folder: '' },
  { shortcut: ';date', text: '{date}', folder: '' },
  { shortcut: ';sig', text: 'Best regards,\nAlex Example\nExample Co. | alex@example.com', folder: '' },
];

class SnipError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function newId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
}

function makeSnippet({ shortcut, text, folder = '' }) {
  const now = Date.now();
  return { id: newId(), shortcut: String(shortcut).trim(), text: String(text), folder: String(folder || '').trim(), createdAt: now, updatedAt: now };
}

function validateSnippet(s, others) {
  const shortcut = String(s.shortcut || '').trim();
  if (!shortcut) throw new SnipError('invalid', 'Shortcut is required.');
  if (/\s/.test(shortcut)) throw new SnipError('invalid', 'Shortcuts cannot contain spaces.');
  if (shortcut.length < 2) throw new SnipError('invalid', 'Shortcuts need at least 2 characters (e.g. ;ty).');
  if (shortcut.length > SHORTCUT_MAX) throw new SnipError('invalid', `Shortcuts can be at most ${SHORTCUT_MAX} characters.`);
  if (!String(s.text || '').length) throw new SnipError('invalid', 'Expansion text is required.');
  if (others.some((o) => o.id !== s.id && o.shortcut === shortcut)) {
    throw new SnipError('duplicate', `The shortcut ${shortcut} is already used.`);
  }
}

async function getProStatus() {
  try { return await isPro(); } catch { return false; }
}

async function getSnippets() {
  const { snippets } = await chrome.storage.local.get('snippets');
  return Array.isArray(snippets) ? snippets : [];
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { syncEnabled: false, ...(settings || {}) };
}

async function setSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings });
  return settings;
}

// Writes the list locally and, when sync is on, to chrome.storage.sync.
// Returns { syncError } if the sync mirror failed (the local save still succeeded).
async function saveSnippets(list, { fromSync = false } = {}) {
  const updatedAt = Date.now();
  await chrome.storage.local.set({ snippets: list, snippetsUpdatedAt: updatedAt });
  if (fromSync) return {};
  const settings = await getSettings();
  if (settings.syncEnabled && await getProStatus()) {
    try {
      await pushToSync(list, updatedAt);
      await setSettings({ syncError: '' });
    } catch (e) {
      const msg = e instanceof SnipError ? e.message : `Sync failed: ${e.message || e}`;
      await setSettings({ syncError: msg });
      return { syncError: msg };
    }
  }
  return {};
}

async function addSnippet(data) {
  const list = await getSnippets();
  if (list.length >= FREE_LIMIT && !(await getProStatus())) {
    throw new SnipError('limit', `Free includes up to ${FREE_LIMIT} snippets. Get Pro for unlimited snippets.`);
  }
  const snip = makeSnippet(data);
  validateSnippet(snip, list);
  list.push(snip);
  const res = await saveSnippets(list);
  return { snippet: snip, ...res };
}

async function updateSnippet(id, patch) {
  const list = await getSnippets();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) throw new SnipError('missing', 'That snippet no longer exists.');
  const next = { ...list[i], ...patch, shortcut: String(patch.shortcut ?? list[i].shortcut).trim(), updatedAt: Date.now() };
  validateSnippet(next, list);
  list[i] = next;
  return { snippet: next, ...(await saveSnippets(list)) };
}

async function deleteSnippet(id) {
  const list = (await getSnippets()).filter((s) => s.id !== id);
  return saveSnippets(list);
}

async function seedExamplesIfEmpty() {
  const { snippets } = await chrome.storage.local.get('snippets');
  if (Array.isArray(snippets)) return false;
  await chrome.storage.local.set({ snippets: EXAMPLE_SNIPPETS.map(makeSnippet), snippetsUpdatedAt: Date.now() });
  return true;
}

// ---------- Import / export (Pro) ----------

function exportJson(list) {
  return JSON.stringify({
    app: 'snipkey',
    version: 1,
    exportedAt: new Date().toISOString(),
    snippets: list.map(({ shortcut, text, folder }) => ({ shortcut, text, folder: folder || '' })),
  }, null, 2);
}

// Minimal RFC 4180 CSV parser (quoted fields, "" escapes, newlines inside quotes).
function parseCsv(src) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function parseImport(textContent, filename = '') {
  const trimmed = textContent.replace(/^﻿/, '').trim();
  let items;
  if (/\.json$/i.test(filename) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data;
    try { data = JSON.parse(trimmed); } catch { throw new SnipError('format', 'That file is not valid JSON.'); }
    items = Array.isArray(data) ? data : data && data.snippets;
    if (!Array.isArray(items)) throw new SnipError('format', 'No snippets found in that JSON file.');
  } else {
    const rows = parseCsv(trimmed);
    if (rows.length && rows[0][0].trim().toLowerCase() === 'shortcut') rows.shift();
    items = rows.map((r) => ({ shortcut: r[0], text: r.slice(1).join(','), folder: '' }));
  }
  const out = [];
  const errors = [];
  items.forEach((it, n) => {
    const s = { shortcut: String((it && it.shortcut) || '').trim(), text: String((it && it.text) ?? ''), folder: String((it && it.folder) || '') };
    try { validateSnippet({ ...s, id: `import-${n}` }, out.map((o, k) => ({ ...o, id: `import-${k}` }))); out.push(s); } catch (e) { errors.push(`Row ${n + 1}: ${e.message}`); }
  });
  return { items: out, errors };
}

// Imported snippets replace existing ones with the same shortcut.
async function importSnippets(items) {
  const list = await getSnippets();
  let added = 0;
  let replaced = 0;
  for (const it of items) {
    const existing = list.find((s) => s.shortcut === it.shortcut);
    if (existing) { Object.assign(existing, { text: it.text, folder: it.folder || existing.folder || '', updatedAt: Date.now() }); replaced++; } else { list.push(makeSnippet(it)); added++; }
  }
  const res = await saveSnippets(list);
  return { added, replaced, ...res };
}

// ---------- chrome.storage.sync mirror (Pro) ----------

const utf8 = new TextEncoder();
const bytes = (s) => utf8.encode(s).length;

function chunkForSync(json) {
  const chunks = [];
  let pos = 0;
  while (pos < json.length) {
    let len = Math.min(json.length - pos, SYNC_ITEM_BUDGET);
    while (bytes(JSON.stringify(json.slice(pos, pos + len))) > SYNC_ITEM_BUDGET - 40) len = Math.floor(len * 0.9);
    // never split a surrogate pair
    const code = json.charCodeAt(pos + len - 1);
    if (len > 1 && code >= 0xd800 && code <= 0xdbff) len--;
    chunks.push(json.slice(pos, pos + len));
    pos += len;
  }
  return chunks;
}

async function pushToSync(list, updatedAt = Date.now()) {
  const json = JSON.stringify(list);
  const chunks = chunkForSync(json);
  const items = {};
  let total = 0;
  chunks.forEach((c, i) => { items[SYNC_PREFIX + i] = c; total += bytes(SYNC_PREFIX + i) + bytes(JSON.stringify(c)); });
  const meta = { count: chunks.length, length: json.length, updatedAt };
  items[SYNC_META] = meta;
  if (total > SYNC_TOTAL_BUDGET) {
    throw new SnipError('quota', `Your snippets (${Math.ceil(total / 1024)} KB) are larger than Chrome sync allows (about 100 KB). They are saved on this device, but not synced. Shorten or remove some snippets to sync again.`);
  }
  const old = await chrome.storage.sync.get(SYNC_META);
  try {
    await chrome.storage.sync.set(items);
  } catch (e) {
    throw new SnipError('quota', `Chrome sync refused the update (${e.message || e}). Your snippets are saved on this device only.`);
  }
  const prev = old[SYNC_META];
  if (prev && prev.count > chunks.length) {
    const stale = [];
    for (let i = chunks.length; i < prev.count; i++) stale.push(SYNC_PREFIX + i);
    await chrome.storage.sync.remove(stale);
  }
}

// Returns { list, updatedAt } or null if sync holds nothing (or an incomplete set of chunks).
async function readFromSync() {
  const all = await chrome.storage.sync.get(null);
  const meta = all[SYNC_META];
  if (!meta || !meta.count) return null;
  let json = '';
  for (let i = 0; i < meta.count; i++) {
    const c = all[SYNC_PREFIX + i];
    if (typeof c !== 'string') return null;
    json += c;
  }
  if (json.length !== meta.length) return null;
  try { return { list: JSON.parse(json), updatedAt: meta.updatedAt }; } catch { return null; }
}

function mergeLists(a, b) {
  const byShortcut = new Map();
  for (const s of [...a, ...b]) {
    const cur = byShortcut.get(s.shortcut);
    if (!cur || (s.updatedAt || 0) > (cur.updatedAt || 0)) byShortcut.set(s.shortcut, s);
  }
  return [...byShortcut.values()].sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
}

// Turn sync on: merge what is already in sync (from other devices) with this device, then push.
async function enableSync() {
  if (!(await getProStatus())) throw new SnipError('pro', 'Sync is a Pro feature.');
  const remote = await readFromSync();
  const local = await getSnippets();
  const merged = remote ? mergeLists(local, remote.list) : local;
  await setSettings({ syncEnabled: true });
  return saveSnippets(merged);
}

async function disableSync() {
  await setSettings({ syncEnabled: false, syncError: '' });
}

// Pull newer data from sync into local storage (called by the background worker).
async function pullFromSync() {
  const settings = await getSettings();
  if (!settings.syncEnabled || !(await getProStatus())) return false;
  const remote = await readFromSync();
  if (!remote) return false;
  const { snippetsUpdatedAt = 0 } = await chrome.storage.local.get('snippetsUpdatedAt');
  if (remote.updatedAt <= snippetsUpdatedAt) return false;
  await chrome.storage.local.set({ snippets: remote.list, snippetsUpdatedAt: remote.updatedAt });
  return true;
}

function openBuyPage() {
  if (typeof LICENSE_CONFIG !== 'undefined' && LICENSE_CONFIG.buyUrl) chrome.tabs.create({ url: LICENSE_CONFIG.buyUrl });
}

function proOnSale() {
  return typeof LICENSE_CONFIG !== 'undefined' && Boolean(LICENSE_CONFIG.storeId && LICENSE_CONFIG.productId && LICENSE_CONFIG.buyUrl);
}
