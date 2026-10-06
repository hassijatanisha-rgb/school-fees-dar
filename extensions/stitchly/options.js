// Options page: licence activation (shared license.js) and plan status.
'use strict';

const $ = (sel) => document.querySelector(sel);

function setMsg(el, text, kind) {
  el.textContent = text;
  el.className = `msg ${kind || ''}`;
}

async function render() {
  const configured = licenseConfigured();
  const pro = await isPro();
  const status = $('#status');
  status.textContent = pro ? 'Pro' : 'Free';
  status.className = `chip ${pro ? 'pro' : 'free'}`;
  $('#plan-text').textContent = pro
    ? 'All features unlocked: PDF export, annotation and region capture.'
    : 'Full-page capture, PNG download and copy are free forever, with no watermark.';
  $('#pro-box').hidden = !pro;
  $('#activate-box').hidden = pro;
  $('#soon').hidden = configured || pro;
  $('#key').disabled = !configured;
  $('#activate').disabled = !configured;
  $('#buy-line').hidden = !LICENSE_CONFIG.buyUrl;
  if (LICENSE_CONFIG.buyUrl) $('#buy').href = LICENSE_CONFIG.buyUrl;
  document.body.dataset.ready = '1';
}

$('#activate').addEventListener('click', async () => {
  const key = $('#key').value.trim();
  const msg = $('#msg');
  if (!key) { setMsg(msg, 'Paste the licence key from your purchase email.', 'err'); return; }
  $('#activate').disabled = true;
  setMsg(msg, 'Checking…');
  const res = await activateLicense(key);
  $('#activate').disabled = false;
  if (res.ok) { $('#key').value = ''; setMsg(msg, ''); setMsg($('#msg2'), 'Pro activated. Enjoy!', 'ok'); }
  else setMsg(msg, res.error, 'err');
  render();
});

$('#key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#activate').click(); });

$('#deactivate').addEventListener('click', async () => {
  $('#deactivate').disabled = true;
  await deactivateLicense();
  $('#deactivate').disabled = false;
  setMsg($('#msg'), 'Pro was deactivated on this device. You can activate the key again any time.', 'ok');
  render();
});

const why = new URLSearchParams(location.search).get('why');
if (why === 'region' || why === 'pro') {
  $('#why').textContent = why === 'region'
    ? 'Capturing a selected region is a Stitchly Pro feature. Unlock it below with a one-time purchase.'
    : 'Stitchly Pro is a one-time US$12 unlock: PDF export, annotation and region capture.';
  $('#why').hidden = false;
}

chrome.storage.onChanged.addListener((changes) => { if (changes.license) render(); });
render();
