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
const t = (key) => T[lang][key] ?? key;

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
  font(28, 700); text(fit(biz.name || t('bizName'), W - PAD * 2 - 200), PAD, y);
  font(22, 700); text(isInvoice ? t('rInvoice') : t('rReceipt'), W - PAD, y, 'right', '#0f766e');
  y += 30; font(16);
  if (biz.phone) text(biz.phone, PAD, y, 'left', '#5b6b68');
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
  font(13); text(`${t('rMadeWith')} ${APP_NAME}${siteLabel() ? ' · ' + siteLabel() : ''}`, W / 2, H - 30, 'center', '#8a9895');
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
    + (site ? `\n\n${t('rMadeWith')} ${APP_NAME}: https://${site}` : '');
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
  render();
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
  if (currentNo && e.target.closest('.card') !== $('bizName').closest('.card')) currentNo = null;
  render();
});
$('addItem').addEventListener('click', () => { addItemRow(); render(); });
$('share').addEventListener('click', share);
$('download').addEventListener('click', download);
$('newDoc').addEventListener('click', newDoc);
$('lang').addEventListener('click', () => { lang = lang === 'sw' ? 'en' : 'sw'; store.set('lang', lang); applyLang(); });

applyLang();
