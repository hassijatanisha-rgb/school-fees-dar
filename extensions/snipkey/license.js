// Pro licence check via Lemon Squeezy's public licence API (no secret key needed).
// Each extension defines LICENSE_CONFIG = { storeId, productId, buyUrl } in its own config.js,
// loaded before this file. Until storeId/productId are filled in, Pro can't be unlocked.
//
// Licence API docs: https://docs.lemonsqueezy.com/api/license-api
'use strict';

const LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000; // re-validate weekly; stay Pro if offline

async function licensePost(action, fields) {
  const res = await fetch(`${LICENSE_API}/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  return res.json();
}

function licenseIsForUs(meta) {
  return Boolean(meta)
    && String(meta.store_id) === String(LICENSE_CONFIG.storeId)
    && String(meta.product_id) === String(LICENSE_CONFIG.productId);
}

function licenseConfigured() {
  return Boolean(typeof LICENSE_CONFIG !== 'undefined' && LICENSE_CONFIG.storeId && LICENSE_CONFIG.productId);
}

// Returns { ok: true } or { ok: false, error: 'message' }.
async function activateLicense(key) {
  if (!licenseConfigured()) return { ok: false, error: 'Pro is not on sale yet.' };
  try {
    const data = await licensePost('activate', { license_key: key.trim(), instance_name: `chrome-${crypto.randomUUID()}` });
    if (!data.activated) return { ok: false, error: data.error || 'That key could not be activated.' };
    if (!licenseIsForUs(data.meta)) return { ok: false, error: 'That key is for a different product.' };
    await chrome.storage.sync.set({ license: { key: key.trim(), instanceId: data.instance.id, checkedAt: Date.now() } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the licence server. Check your connection and try again.' };
  }
}

async function isPro() {
  const { license } = await chrome.storage.sync.get('license');
  if (!license || !licenseConfigured()) return false;
  if (Date.now() - license.checkedAt < RECHECK_MS) return true;
  try {
    const data = await licensePost('validate', { license_key: license.key, instance_id: license.instanceId });
    if (data.valid && licenseIsForUs(data.meta)) {
      await chrome.storage.sync.set({ license: { ...license, checkedAt: Date.now() } });
      return true;
    }
    await chrome.storage.sync.remove('license'); // refunded, disabled or deactivated
    return false;
  } catch {
    return true; // offline: keep Pro until we can check again
  }
}

async function deactivateLicense() {
  const { license } = await chrome.storage.sync.get('license');
  if (license) {
    try { await licensePost('deactivate', { license_key: license.key, instance_id: license.instanceId }); } catch { /* ignore */ }
  }
  await chrome.storage.sync.remove('license');
}
