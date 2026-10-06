'use strict';

const APP_NAME = 'Risiti Rahisi';

const T = {
  sw: {
    business: 'Biashara yako', bizName: 'Jina la biashara', phone: 'Simu', tin: 'TIN (si lazima)',
    address: 'Mahali (si lazima)', receipt: 'Risiti', invoice: 'Ankara', customer: 'Mteja',
    custPhone: 'Simu ya mteja', addItem: '+ Ongeza bidhaa', total: 'Jumla', method: 'Imelipwa kwa',
    cash: 'Taslimu', bank: 'Benki', ref: 'Namba ya muamala', notes: 'Maelezo (si lazima)',
    share: 'Tuma kwa WhatsApp', download: 'Pakua picha', new: 'Mpya',
    privacy: 'Taarifa zako zinabaki kwenye simu yako tu.', history: 'Historia',
    itemName: 'Bidhaa / huduma', price: 'Bei', empty: 'Bado hakuna risiti.',
    // on the image
    rReceipt: 'RISITI', rInvoice: 'ANKARA', rNo: 'Na.', rDate: 'Tarehe', rTo: 'Kwa', rItem: 'Bidhaa',
    rQty: 'Idadi', rPrice: 'Bei', rAmount: 'Kiasi', rPaidVia: 'Imelipwa kwa', rDue: 'Kiasi cha kulipa',
    rThanks: 'Asante kwa biashara yako!', rMadeWith: 'Imetengenezwa bure na',
    msgReceipt: 'Risiti yako', msgInvoice: 'Ankara yako', needItem: 'Ongeza angalau bidhaa moja yenye bei.',
    logo: 'Nembo yako (Basic)', sales: 'Mauzo yako (Pro)', backup: 'Hifadhi nakala', restore: 'Rejesha nakala',
    plans: 'Mipango', free: 'Bure', freeDesc: 'Risiti na ankara bila kikomo.',
    basicDesc: 'Nembo yako kwenye risiti, bila tangazo la Risiti Rahisi.',
    proDesc: 'Basic + orodha ya wateja, jumla ya mauzo ya leo na mwezi, Excel, na nakala ya kuhifadhi.',
    code: 'Namba ya kufungua', apply: 'Fungua', month: 'mwezi',
    planFree: 'Unatumia mpango wa Bure.', planActive: 'Mpango wako: {p} hadi {e}.',
    expired: 'Mpango wako wa {p} uliisha {e}. Lipia kuendelea.', badCode: 'Namba hii si sahihi.',
    wrongPhone: 'Namba hii ni ya simu ya biashara {phone}. Weka simu hiyo kwenye Biashara yako.',
    payHow: 'Lipa {basic} (Basic) au {pro} (Pro) kwa mwezi kwa namba {num} ({name}). Kisha tutumie namba ya muamala:',
    payWa: 'Tuma kwenye WhatsApp', soon: 'Malipo yatafunguliwa hivi karibuni.',
    today: 'Leo', thisMonth: 'Mwezi huu', receipts: 'risiti',
    needPlan: 'Hii ni ya mpango wa {p}. Angalia Mipango hapo chini.',
    restored: 'Nakala imerejeshwa.', restoreAsk: 'Hii itabadilisha historia yako yote. Endelea?',
    paidMsg: 'Habari, nimelipa Risiti Rahisi {p}. Namba ya muamala: ____ . Simu ya biashara: {phone}',
  },
  en: {
    business: 'Your business', bizName: 'Business name', phone: 'Phone', tin: 'TIN (optional)',
    address: 'Location (optional)', receipt: 'Receipt', invoice: 'Invoice', customer: 'Customer',
    custPhone: 'Customer phone', addItem: '+ Add item', total: 'Total', method: 'Paid via',
    cash: 'Cash', bank: 'Bank', ref: 'Transaction ID', notes: 'Notes (optional)',
    share: 'Send on WhatsApp', download: 'Download image', new: 'New',
    privacy: 'Your data stays on your phone only.', history: 'History',
    itemName: 'Item / service', price: 'Price', empty: 'No receipts yet.',
    rReceipt: 'RECEIPT', rInvoice: 'INVOICE', rNo: 'No.', rDate: 'Date', rTo: 'To', rItem: 'Item',
    rQty: 'Qty', rPrice: 'Price', rAmount: 'Amount', rPaidVia: 'Paid via', rDue: 'Amount due',
    rThanks: 'Thank you for your business!', rMadeWith: 'Made free with',
    msgReceipt: 'Your receipt', msgInvoice: 'Your invoice', needItem: 'Add at least one item with a price.',
    logo: 'Your logo (Basic)', sales: 'Your sales (Pro)', backup: 'Save backup', restore: 'Restore backup',
    plans: 'Plans', free: 'Free', freeDesc: 'Unlimited receipts and invoices.',
    basicDesc: 'Your logo on receipts, no Risiti Rahisi footer.',
    proDesc: 'Basic + customer list, today and this month sales totals, Excel export and backup.',
    code: 'Unlock code', apply: 'Unlock', month: 'month',
    planFree: 'You are on the Free plan.', planActive: 'Your plan: {p} until {e}.',
    expired: 'Your {p} plan ended on {e}. Pay to continue.', badCode: 'That code is not valid.',
    wrongPhone: 'This code is for business phone {phone}. Put that phone under Your business.',
    payHow: 'Pay {basic} (Basic) or {pro} (Pro) per month to {num} ({name}). Then send us the transaction ID:',
    payWa: 'Send on WhatsApp', soon: 'Paid plans are coming soon.',
    today: 'Today', thisMonth: 'This month', receipts: 'receipts',
    needPlan: 'This is part of the {p} plan. See Plans below.',
    restored: 'Backup restored.', restoreAsk: 'This replaces all your history. Continue?',
    paidMsg: 'Hi, I paid for Risiti Rahisi {p}. Transaction ID: ____ . Business phone: {phone}',
  },
};

const METHOD_LABEL = { mpesa: 'M-Pesa', mixx: 'Mixx by Yas', airtel: 'Airtel Money', halo: 'HaloPesa' };

// Storage can be blocked (private mode); the app must still work without it.
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

const $ = (id) => document.getElementById(id);
let lang = store.get('lang', 'sw');
let currentNo = null; // set once a document is issued (shared/downloaded), reused on re-share
const t = (key, vars = {}) => (T[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/* ---------- plans ---------- */

const RANK = { free: 0, basic: 1, pro: 2 };
const PLAN_NAME = { basic: 'Basic', pro: 'Pro' };
let plan = 'free';
let logoImg = null;
const can = (p) => RANK[plan] >= RANK[p];
// config.js declares a top-level const, which is not a window property.
const cfg = () => (typeof CONFIG !== 'undefined' ? CONFIG : null);

function requirePlan(p) {
  if (can(p)) return true;
  alert(t('needPlan', { p: PLAN_NAME[p] }));
  $('planCard').scrollIntoView({ behavior: 'smooth' });
  return false;
}

function b64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}

// Unlock codes are "payload.signature", signed by the owner's private key (admin.html).
// The app only holds the public key, so it can check codes but never make them.
async function verifyCode(code) {
  try {
    const [p64, s64] = String(code).trim().split('.');
    if (!p64 || !s64 || !cfg() || !crypto.subtle) return null;
    const key = await crypto.subtle.importKey('jwk', cfg().publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(s64), new TextEncoder().encode(p64));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64u(p64)));
    return RANK[data.p] ? data : null;
  } catch { return null; }
}

function localPhone(intl) {
  return intl && intl.startsWith('255') ? '0' + intl.slice(3) : intl;
}

async function checkPlan() {
  const data = await verifyCode(store.get('license', ''));
  let status = t('planFree');
  plan = 'free';
  if (data) {
    const expired = new Date(data.e + 'T23:59:59') < new Date();
    const phoneOk = !data.b || data.b === waNumber($('bizPhone').value);
    if (expired) status = t('expired', { p: PLAN_NAME[data.p], e: data.e });
    else if (!phoneOk) status = t('wrongPhone', { phone: localPhone(data.b) });
    else { plan = data.p; status = t('planActive', { p: PLAN_NAME[data.p], e: data.e }); }
  }
  $('planStatus').textContent = status;
  applyPlan();
}

async function applyCode(code) {
  const data = await verifyCode(code);
  if (!data) { alert(t('badCode')); return; }
  store.set('license', code.trim());
  if (data.b && !$('bizPhone').value.trim()) { $('bizPhone').value = localPhone(data.b); store.set('biz', readBiz()); }
  $('licInput').value = '';
  await checkPlan();
}

function applyPlan() {
  $('proCard').classList.toggle('locked', !can('pro'));
  $('logo').closest('label').classList.toggle('locked', !can('basic'));
  const prices = (cfg() && cfg().prices) || { basic: 10000, pro: 20000 };
  document.querySelectorAll('.price-basic').forEach((el) => { el.textContent = `${money(prices.basic)}/${t('month')}`; });
  document.querySelectorAll('.price-pro').forEach((el) => { el.textContent = `${money(prices.pro)}/${t('month')}`; });
  const pay = $('howToPay');
  pay.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'pay';
  if (cfg() && cfg().payNumber && cfg().whatsapp) {
    box.textContent = t('payHow', { basic: money(prices.basic), pro: money(prices.pro), num: cfg().payNumber, name: cfg().payName });
    const a = document.createElement('a');
    const wanted = can('basic') ? 'Pro' : 'Basic / Pro';
    a.href = `https://wa.me/${waNumber(cfg().whatsapp)}?text=${encodeURIComponent(t('paidMsg', { p: wanted, phone: $('bizPhone').value.trim() }))}`;
    a.target = '_blank'; a.rel = 'noopener';
    a.textContent = t('payWa');
    box.appendChild(a);
  } else {
    box.textContent = t('soon');
  }
  pay.appendChild(box);
  renderPro();
  render();
}

function loadLogo() {
  const src = store.get('logo', '');
  if (!src) { logoImg = null; return; }
  const img = new Image();
  img.onload = () => { logoImg = img; render(); };
  img.src = src;
}

function setLogo(file) {
  const img = new Image();
  img.onload = () => {
    const size = 160, k = Math.min(size / img.width, size / img.height, 1);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    store.set('logo', c.toDataURL('image/png'));
    URL.revokeObjectURL(img.src);
    loadLogo();
  };
  img.src = URL.createObjectURL(file);
}

/* ---------- Pro tools ---------- */

function renderPro() {
  const history = store.get('history', []);
  const today = new Date().toISOString().slice(0, 10);
  const sum = (list) => list.reduce((s, d) => s + total(d), 0);
  const receipts = history.filter((d) => d.type === 'receipt');
  const dayList = receipts.filter((d) => d.date === today);
  const monthList = receipts.filter((d) => d.date.slice(0, 7) === today.slice(0, 7));
  $('summary').textContent = `${t('today')}: ${money(sum(dayList))} (${dayList.length} ${t('receipts')}) · `
    + `${t('thisMonth')}: ${money(sum(monthList))} (${monthList.length} ${t('receipts')})`;
  const list = $('custList');
  list.innerHTML = '';
  if (!can('pro')) return;
  [...new Set(history.map((d) => d.customer).filter(Boolean))].forEach((name) => {
    const o = document.createElement('option'); o.value = name; list.appendChild(o);
  });
}

function saveFile(name, type, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  if (!requirePlan('pro')) return;
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['No', 'Type', 'Date', 'Customer', 'Phone', 'Total', 'Method', 'Ref', 'Notes']];
  store.get('history', []).forEach((d) => rows.push([d.no, d.type, d.date, d.customer, d.custPhone, total(d), d.method, d.ref, d.notes]));
  saveFile(`risiti-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', '\ufeff' + rows.map((r) => r.map(q).join(',')).join('\n'));
}

function backup() {
  if (!requirePlan('pro')) return;
  const data = { app: 'risiti-rahisi', v: 1, biz: readBiz(), history: store.get('history', []), counters: store.get('counters', {}), logo: store.get('logo', '') };
  saveFile(`risiti-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(data));
}

function restore(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== 'risiti-rahisi' || !Array.isArray(data.history)) throw new Error('bad file');
      if (!confirm(t('restoreAsk'))) return;
      store.set('history', data.history);
      store.set('counters', data.counters || {});
      if (data.logo) store.set('logo', data.logo);
      if (data.biz) { store.set('biz', data.biz); location.reload(); return; }
      renderHistory(); renderPro(); loadLogo();
      alert(t('restored'));
    } catch { alert(t('badCode')); }
  };
  reader.readAsText(file);
}

function money(n) {
  return 'TSh ' + Math.round(n).toLocaleString('en-US');
}

function num(value) {
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '255' + d.slice(1);
  else if (d.length === 9 && /^[67]/.test(d)) d = '255' + d;
  return d.length >= 12 ? d : '';
}

function siteLabel() {
  return location.protocol.startsWith('http') ? location.host : '';
}

/* ---------- form state ---------- */

function readDoc() {
  const items = [...document.querySelectorAll('#items .item')].map((row) => ({
    name: row.querySelector('.name').value.trim(),
    qty: num(row.querySelector('.qty').value) || 1,
    price: num(row.querySelector('.price').value),
  })).filter((i) => i.name || i.price);
  return {
    type: document.querySelector('input[name=type]:checked').value,
    no: currentNo,
    date: new Date().toISOString().slice(0, 10),
    customer: $('customer').value.trim(),
    custPhone: $('custPhone').value.trim(),
    items,
    method: $('method').value,
    ref: $('ref').value.trim(),
    notes: $('notes').value.trim(),
  };
}

function readBiz() {
  return {
    name: $('bizName').value.trim(), phone: $('bizPhone').value.trim(),
    tin: $('bizTin').value.trim(), address: $('bizAddress').value.trim(),
  };
}

const total = (doc) => doc.items.reduce((s, i) => s + i.qty * i.price, 0);

function addItemRow(item = {}) {
  const row = $('itemTpl').content.firstElementChild.cloneNode(true);
  row.querySelector('.name').value = item.name || '';
  row.querySelector('.qty').value = item.qty ?? 1;
  row.querySelector('.price').value = item.price || '';
  row.querySelector('.name').placeholder = t('itemName');
  row.querySelector('.price').placeholder = t('price');
  row.querySelector('.del').addEventListener('click', () => {
    row.remove();
    if (!document.querySelector('#items .item')) addItemRow();
    render();
  });
  $('items').appendChild(row);
}

function loadDoc(doc) {
  currentNo = doc.no || null;
  document.querySelector(`input[name=type][value=${doc.type}]`).checked = true;
  $('customer').value = doc.customer || '';
  $('custPhone').value = doc.custPhone || '';
  $('method').value = doc.method || 'cash';
  $('ref').value = doc.ref || '';
  $('notes').value = doc.notes || '';
  $('items').innerHTML = '';
  (doc.items.length ? doc.items : [{}]).forEach(addItemRow);
  render();
}

function newDoc() {
  loadDoc({ type: document.querySelector('input[name=type]:checked').value, items: [] });
}

/* ---------- the image ---------- */

function drawReceipt(canvas, biz, doc) {
  const W = 720, PAD = 40, SCALE = 2;
  const isInvoice = doc.type === 'invoice';
  const rows = Math.max(doc.items.length, 1);
  const H = 460 + rows * 44 + (doc.notes ? 40 : 0) + (biz.address ? 26 : 0) + (biz.tin ? 26 : 0);
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const c = canvas.getContext('2d');
  c.scale(SCALE, SCALE);
  const font = (size, weight = 400) => { c.font = `${weight} ${size}px system-ui, -apple-system, Roboto, sans-serif`; };
  const text = (s, x, y, align = 'left', color = '#14201e') => { c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y); };
  const fit = (s, max) => { let out = s; while (out && c.measureText(out).width > max) out = out.slice(0, -2); return out === s ? s : out + '…'; };
  const rule = (y) => { c.fillStyle = '#d9e0de'; c.fillRect(PAD, y, W - PAD * 2, 1); };

  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#0f766e'; c.fillRect(0, 0, W, 8);

  let y = 62;
  let nameX = PAD;
  if (logoImg && can('basic')) {
    const k = Math.min(64 / logoImg.width, 64 / logoImg.height);
    c.drawImage(logoImg, PAD, 24, logoImg.width * k, logoImg.height * k);
    nameX = PAD + logoImg.width * k + 16;
  }
  font(28, 700); text(fit(biz.name || t('bizName'), W - nameX - PAD - 200), nameX, y);
  font(22, 700); text(isInvoice ? t('rInvoice') : t('rReceipt'), W - PAD, y, 'right', '#0f766e');
  y += 30; font(16);
  if (biz.phone) text(biz.phone, nameX, y, 'left', '#5b6b68');
  text(`${t('rNo')} ${doc.no || '—'}`, W - PAD, y, 'right', '#5b6b68');
  y += 26;
  if (biz.address) { text(fit(biz.address, W - PAD * 2 - 220), PAD, y, 'left', '#5b6b68'); }
  text(`${t('rDate')} ${doc.date}`, W - PAD, y, 'right', '#5b6b68');
  if (biz.address) y += 26;
  if (biz.tin) { text(`TIN ${biz.tin}`, PAD, y, 'left', '#5b6b68'); y += 26; }

  y += 14; rule(y); y += 34;
  if (doc.customer || doc.custPhone) {
    font(16); text(`${t('rTo')}: `, PAD, y, 'left', '#5b6b68');
    font(18, 600); text(fit([doc.customer, doc.custPhone].filter(Boolean).join(' · '), W - PAD * 2 - 50), PAD + 44, y);
  }
  y += 36;

  font(14, 600);
  text(t('rItem'), PAD, y, 'left', '#5b6b68');
  text(t('rQty'), 430, y, 'right', '#5b6b68');
  text(t('rPrice'), 540, y, 'right', '#5b6b68');
  text(t('rAmount'), W - PAD, y, 'right', '#5b6b68');
  y += 12; rule(y); y += 30;

  font(17);
  doc.items.forEach((i) => {
    text(fit(i.name || '—', 330), PAD, y);
    text(String(i.qty), 430, y, 'right');
    text(Math.round(i.price).toLocaleString('en-US'), 540, y, 'right');
    text(Math.round(i.qty * i.price).toLocaleString('en-US'), W - PAD, y, 'right');
    y += 44;
  });
  if (!doc.items.length) y += 44;

  rule(y - 22); y += 16;
  font(18, 600); text(isInvoice ? t('rDue') : t('total'), PAD, y);
  font(26, 700); text(money(total(doc)), W - PAD, y, 'right', '#0f766e');
  y += 40;

  if (!isInvoice) {
    font(16);
    const via = METHOD_LABEL[doc.method] || t(doc.method);
    text(`${t('rPaidVia')}: ${via}${doc.ref ? ' · ' + doc.ref : ''}`, PAD, y, 'left', '#5b6b68');
    y += 30;
  }
  if (doc.notes) { font(16); text(fit(doc.notes, W - PAD * 2), PAD, y, 'left', '#5b6b68'); y += 40; }

  font(18, 600); text(t('rThanks'), W / 2, H - 70, 'center');
  if (!can('basic')) {
    font(13); text(`${t('rMadeWith')} ${APP_NAME}${siteLabel() ? ' · ' + siteLabel() : ''}`, W / 2, H - 30, 'center', '#8a9895');
  }
}

/* ---------- actions ---------- */

function render() {
  const doc = readDoc();
  $('total').textContent = money(total(doc));
  $('payRow').hidden = doc.type === 'invoice';
  drawReceipt($('preview'), readBiz(), doc);
  store.set('biz', readBiz());
}

function issue() {
  const doc = readDoc();
  if (!doc.items.some((i) => i.price > 0)) { alert(t('needItem')); return null; }
  if (!currentNo) {
    const counters = store.get('counters', { receipt: 0, invoice: 0 });
    counters[doc.type] += 1;
    store.set('counters', counters);
    currentNo = (doc.type === 'invoice' ? 'A-' : 'R-') + String(counters[doc.type]).padStart(4, '0');
    doc.no = currentNo;
    const history = store.get('history', []);
    history.unshift(doc);
    store.set('history', history.slice(0, 100));
    renderHistory();
    renderPro();
  }
  doc.no = currentNo;
  drawReceipt($('preview'), readBiz(), doc);
  return doc;
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function download() {
  const doc = issue(); if (!doc) return;
  const blob = await toBlob($('preview'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.no}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function share() {
  const doc = issue(); if (!doc) return;
  const biz = readBiz();
  const site = siteLabel();
  const msg = `${doc.type === 'invoice' ? t('msgInvoice') : t('msgReceipt')} ${doc.no} – ${biz.name || ''}: ${money(total(doc))}`
    + (site && !can('basic') ? `\n\n${t('rMadeWith')} ${APP_NAME}: https://${site}` : '');
  const blob = await toBlob($('preview'));
  const file = new File([blob], `${doc.no}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: msg }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  // No file sharing (desktop browsers): save the image and open WhatsApp with the text.
  await download();
  const to = waNumber(doc.custPhone);
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

function renderHistory() {
  const list = $('history');
  const history = store.get('history', []);
  list.innerHTML = '';
  if (!history.length) { const li = document.createElement('li'); li.textContent = t('empty'); list.appendChild(li); return; }
  history.forEach((doc) => {
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = `${doc.no} · ${doc.customer || '—'} · ${doc.date}`;
    const right = document.createElement('strong');
    right.textContent = money(total(doc));
    li.append(left, right);
    li.addEventListener('click', () => { loadDoc(doc); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    list.appendChild(li);
  });
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('#items .name').forEach((el) => { el.placeholder = t('itemName'); });
  document.querySelectorAll('#items .price').forEach((el) => { el.placeholder = t('price'); });
  $('lang').textContent = lang === 'sw' ? 'English' : 'Kiswahili';
  renderHistory();
  if ($('planStatus').textContent) checkPlan(); else applyPlan();
}

/* ---------- start ---------- */

const biz = store.get('biz', {});
$('bizName').value = biz.name || '';
$('bizPhone').value = biz.phone || '';
$('bizTin').value = biz.tin || '';
$('bizAddress').value = biz.address || '';
addItemRow();

document.querySelector('main').addEventListener('input', (e) => {
  // Editing an issued document's content makes it a new document with a new number.
  if (currentNo && e.target.closest('#docCard')) currentNo = null;
  if (e.target.closest('#docCard') || e.target.closest('.card') === $('bizName').closest('.card')) render();
});
$('bizPhone').addEventListener('change', checkPlan);
$('logo').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file && requirePlan('basic')) setLogo(file);
});
$('customer').addEventListener('change', () => {
  if (!can('pro') || $('custPhone').value.trim()) return;
  const match = store.get('history', []).find((d) => d.customer === $('customer').value.trim() && d.custPhone);
  if (match) { $('custPhone').value = match.custPhone; render(); }
});
$('licApply').addEventListener('click', () => applyCode($('licInput').value));
$('exportCsv').addEventListener('click', exportCsv);
$('backup').addEventListener('click', backup);
$('restoreBtn').addEventListener('click', () => { if (requirePlan('pro')) $('restore').click(); });
$('restore').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); });
$('addItem').addEventListener('click', () => { addItemRow(); render(); });
$('share').addEventListener('click', share);
$('download').addEventListener('click', download);
$('newDoc').addEventListener('click', newDoc);
$('lang').addEventListener('click', () => { lang = lang === 'sw' ? 'en' : 'sw'; store.set('lang', lang); applyLang(); });

// An unlock link looks like https://site/?code=XXXX: apply it, then tidy the address bar.
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) {
  history.replaceState(null, '', location.pathname);
  applyCode(urlCode);
}

loadLogo();
applyLang();
checkPlan();
