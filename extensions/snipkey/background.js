// Snipkey background service worker: first-run examples, Pro status for the content script, sync pulls.
'use strict';

importScripts('config.js', 'license.js', 'lib/snippets.js');

chrome.runtime.onInstalled.addListener(async () => {
  await seedExamplesIfEmpty();
  pullFromSync().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  pullFromSync().catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[SYNC_META]) pullFromSync().catch(() => {});
});

// The content script only ever asks one question: is Pro active? (It never sends page content.)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'snipkey:isPro') {
    getProStatus().then((pro) => sendResponse({ pro }));
    return true;
  }
  return false;
});
