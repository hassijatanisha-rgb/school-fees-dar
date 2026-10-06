// Stitchly service worker: drives the capture and hands the frames to the result page.
'use strict';
importScripts('config.js', 'license.js', 'lib/jobs.js');

const CAPTURE_GAP_MS = 550;      // Chrome allows ~2 captureVisibleTab calls per second
const MAX_FRAMES = 250;          // safety net for endless-scroll pages
const MAX_CSS_HEIGHT = 120000;   // stop after ~120k CSS px of content

let busy = false;
let lastCaptureAt = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'full', title: 'Capture full page', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'region', title: 'Capture selected region (Pro)', contexts: ['action'] });
  });
});

chrome.action.onClicked.addListener((tab) => captureFull(tab));
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-region' && tab) captureRegion(tab);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  if (info.menuItemId === 'full') captureFull(tab);
  if (info.menuItemId === 'region') captureRegion(tab);
});

function restrictedReason(url) {
  if (!url) return null; // unknown: just try
  if (/^(chrome|edge|brave|opera|vivaldi|about|chrome-untrusted|chrome-search|devtools|view-source|chrome-extension|extension):/i.test(url)) return 'browser';
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)) return 'store';
  return null;
}

// Without access Chrome hides the URL, which itself means the page is a protected one.
function injectErrorCode(tab) {
  if (!tab.url) return 'browser';
  return /^file:/i.test(tab.url) ? 'file' : 'blocked';
}

function openResult(tab, query) {
  return chrome.tabs.create({ url: `result.html?${query}`, index: tab.index + 1, openerTabId: tab.id });
}

function showError(tab, code) {
  return openResult(tab, `error=${encodeURIComponent(code)}&from=${encodeURIComponent(tab.url || '')}`);
}

function setBadge(tabId, text) {
  chrome.action.setBadgeBackgroundColor({ color: '#0f766e' }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAgent(tabId, method, args = []) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m, a) => window.__stitchly[m](...a),
    args: [method, args],
  });
  return res.result;
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
}

async function grab(tab) {
  const wait = lastCaptureAt + CAPTURE_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const current = await chrome.tabs.get(tab.id);
  if (!current.active) throw Object.assign(new Error('tab-switched'), { code: 'switched' });
  for (let attempt = 0; ; attempt++) {
    try {
      lastCaptureAt = Date.now();
      const url = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return dataUrlToBlob(url);
    } catch (e) {
      // Rate-limit errors: back off and retry a couple of times.
      if (attempt < 3 && /MAX_CAPTURE|quota|rate/i.test(String(e && e.message))) { await sleep(1000); continue; }
      throw e;
    }
  }
}

async function inject(tab) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['page/agent.js'] });
}

function newJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function captureFull(tab) {
  if (busy) return null;
  const reason = restrictedReason(tab.url);
  if (reason) { await showError(tab, reason); return null; }
  busy = true;
  let prepared = false;
  try {
    try { await inject(tab); } catch (e) {
      await showError(tab, injectErrorCode(tab));
      return null;
    }
    setBadge(tab.id, '…');
    const info = await callAgent(tab.id, 'prepare');
    prepared = true;
    const frames = [];
    let truncated = false;
    let y = 0;
    for (let i = 0; ; i++) {
      const pos = await callAgent(tab.id, 'scrollTo', [y, i]);
      const blob = await grab(tab);
      frames.push({ blob, scrollTop: pos.scrollTop });
      const max = Math.max(1, pos.scrollHeight - info.clientHeight);
      setBadge(tab.id, `${Math.min(99, Math.round((pos.scrollTop / max) * 100))}%`);
      if (pos.isLast) break;
      if (frames.length >= MAX_FRAMES || pos.scrollTop + info.clientHeight >= MAX_CSS_HEIGHT) { truncated = true; break; }
      const next = pos.scrollTop + info.rect.H;
      if (next <= pos.scrollTop) break;
      y = next;
    }
    const restored = await callAgent(tab.id, 'restore');
    prepared = false;
    const job = { id: newJobId(), kind: 'full', createdAt: Date.now(), info, frames, truncated, restored };
    await saveJob(job);
    await openResult(tab, `job=${job.id}`);
    return { id: job.id, frames: frames.length, info, restored, truncated };
  } catch (e) {
    console.error('Stitchly capture failed', e);
    await showError(tab, e && e.code === 'switched' ? 'switched' : 'failed');
    return null;
  } finally {
    if (prepared) await callAgent(tab.id, 'restore').catch(() => {});
    setBadge(tab.id, '');
    busy = false;
  }
}

async function captureRegion(tab) {
  if (busy) return null;
  if (!(await isPro())) {
    await chrome.tabs.create({ url: 'options.html?why=region', index: tab.index + 1 });
    return null;
  }
  const reason = restrictedReason(tab.url);
  if (reason) { await showError(tab, reason); return null; }
  busy = true;
  try {
    try { await inject(tab); } catch (e) {
      await showError(tab, injectErrorCode(tab));
      return null;
    }
    const sel = await callAgent(tab.id, 'selectRegion');
    if (!sel) return null;
    const blob = await grab(tab);
    const job = { id: newJobId(), kind: 'region', createdAt: Date.now(), info: sel, frames: [{ blob, scrollTop: 0 }] };
    await saveJob(job);
    await openResult(tab, `job=${job.id}`);
    return { id: job.id, info: sel };
  } catch (e) {
    console.error('Stitchly region capture failed', e);
    await showError(tab, 'failed');
    return null;
  } finally {
    busy = false;
  }
}

// Exposed for the automated tests (tests/run-tests.mjs); not used by the UI.
self.stitchly = { captureFull, captureRegion };
