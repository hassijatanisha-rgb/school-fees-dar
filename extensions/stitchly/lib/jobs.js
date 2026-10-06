// Tiny IndexedDB store shared by the service worker and the result page.
// Captures never leave the device; only the last few are kept.
'use strict';

const JOBS_DB = 'stitchly';
const JOBS_KEEP = 3;

function jobsOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(JOBS_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('jobs', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function jobsTx(mode, fn) {
  return jobsOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', mode);
    const out = fn(tx.objectStore('jobs'));
    tx.oncomplete = () => { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

async function saveJob(job) {
  await jobsTx('readwrite', (s) => s.put(job));
  const all = await jobsTx('readonly', (s) => s.getAllKeys());
  const old = all.sort().slice(0, Math.max(0, all.length - JOBS_KEEP));
  if (old.length) await jobsTx('readwrite', (s) => { old.forEach((k) => s.delete(k)); });
}

function loadJob(id) {
  return jobsTx('readonly', (s) => s.get(id));
}
