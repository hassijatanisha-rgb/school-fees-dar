'use strict';

const $ = (id) => document.getElementById(id);
let pro = false;
let all = [];

function setMsg(text, kind = 'error') {
  const el = $('addMsg');
  el.textContent = text;
  el.className = `msg ${kind}`;
}

function showUpgrade(show) {
  $('upgrade').classList.toggle('hidden', !show);
  const btn = $('getPro');
  if (!proOnSale()) { btn.textContent = 'Pro coming soon'; btn.disabled = true; }
}

function render() {
  const q = $('search').value.trim().toLowerCase();
  const list = $('list');
  list.textContent = '';
  const shown = all.filter((s) => !q || s.shortcut.toLowerCase().includes(q) || s.text.toLowerCase().includes(q) || (s.folder || '').toLowerCase().includes(q));
  shown.forEach((s) => {
    const li = document.createElement('li');
    const inactive = !pro && all.indexOf(s) >= FREE_LIMIT;
    if (inactive) { li.classList.add('inactive'); li.title = 'Inactive on Free (only the first 10 snippets expand)'; }
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = s.shortcut;
    const prev = document.createElement('span');
    prev.className = 'preview';
    prev.textContent = s.text.replace(/\s+/g, ' ');
    li.append(chip, prev);
    li.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#edit=${encodeURIComponent(s.id)}`) });
    });
    list.appendChild(li);
  });
  $('empty').classList.toggle('hidden', shown.length > 0);
  const plan = $('plan');
  plan.textContent = pro ? 'Pro' : `Free · ${Math.min(all.length, FREE_LIMIT)}/${FREE_LIMIT}`;
  plan.classList.toggle('pro', pro);
  if (!pro && all.length >= FREE_LIMIT) showUpgrade(true);
}

async function load() {
  [pro, all] = await Promise.all([getProStatus(), getSnippets()]);
  render();
}

$('search').addEventListener('input', render);
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('getPro').addEventListener('click', openBuyPage);

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');
  try {
    const res = await addSnippet({ shortcut: $('addShortcut').value, text: $('addText').value });
    $('addShortcut').value = '';
    $('addText').value = '';
    setMsg(res.syncError ? `Added. ${res.syncError}` : `Added ${res.snippet.shortcut}.`, res.syncError ? 'warn' : 'ok');
    await load();
  } catch (err) {
    setMsg(err.message || String(err));
    if (err.code === 'limit') showUpgrade(true);
  }
});

chrome.storage.onChanged.addListener(() => load());
load();
