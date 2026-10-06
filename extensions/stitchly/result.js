// Result page: stitches the frames, shows the image, and handles download/copy/PDF/annotation.
'use strict';

const MAX_SIDE = 16384; // Chrome's practical canvas limit per side
const $ = (sel) => document.querySelector(sel);
const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Pro"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

const ERRORS = {
  browser: ['Chrome protects this page', 'Chrome doesn\'t allow extensions to capture this page. Its own pages (chrome:// settings, the New Tab page), the Chrome Web Store and other extensions\' pages are protected. Open a normal website and click Stitchly again.'],
  store: ['The Chrome Web Store can\'t be captured', 'Chrome blocks every extension from reading or capturing Web Store pages. Try any other website.'],
  file: ['Allow access to local files first', 'To capture files on your computer, open chrome://extensions, click Details under Stitchly and switch on "Allow access to file URLs". Then reload the file and try again.'],
  blocked: ['Chrome blocked this capture', 'This page can\'t be captured by extensions (it may be protected by Chrome or by your organisation\'s policy). Try another page.'],
  switched: ['Capture stopped', 'You switched tabs while Stitchly was scrolling. Stay on the page until the percentage on the toolbar icon disappears, then try again.'],
  failed: ['Something went wrong', 'The capture didn\'t finish. Reload the page and try again. If it keeps happening, the page may be blocking scripted scrolling.'],
  missing: ['This capture is gone', 'Stitchly keeps only your last 3 captures, on this device. Capture the page again to get a fresh image.'],
};

const state = {
  job: null,
  parts: [],          // { base, canvas, svg, shapes, scale, cssW }
  pro: false,
  annotating: false,
  tool: 'rect',
  color: '#e11d48',
  history: [],        // part indexes, newest last, for undo
  zoom: 1,
};

const ZOOMS = [0.25, 0.33, 0.5, 0.75, 1];

function setZoom(z) {
  state.zoom = z;
  for (const part of state.parts) part.canvas.style.width = `${(part.canvas.width / part.scale) * z}px`;
  $('#zoom-label').textContent = `${Math.round(z * 100)}%`;
  $('#zoom-out').disabled = z <= ZOOMS[0];
  $('#zoom-in').disabled = z >= ZOOMS[ZOOMS.length - 1];
}

function stepZoom(dir) {
  const i = ZOOMS.indexOf(state.zoom);
  const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.length - 1 : i) + dir))];
  setZoom(next);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function showError(code, from) {
  const [title, body] = ERRORS[code] || ERRORS.failed;
  document.title = 'Stitchly · ' + title;
  $('#status').hidden = true;
  const card = document.createElement('div');
  card.className = 'card error-card';
  card.innerHTML = '<h1></h1><p></p><p class="muted small"></p>';
  card.querySelector('h1').textContent = title;
  card.querySelector('p').textContent = body;
  if (from) card.querySelector('.small').textContent = `Page: ${from}`;
  $('#parts').appendChild(card);
  document.body.dataset.ready = 'error';
}

// ---------- stitching ----------

async function stitch(job) {
  const { info, frames } = job;
  const first = await createImageBitmap(frames[0].blob);
  const scale = first.width / info.innerWidth; // device px per CSS px
  first.close();

  if (job.kind === 'region') {
    const outScale = Math.min(scale, MAX_SIDE / info.w, MAX_SIDE / info.h);
    const w = Math.max(1, Math.round(info.w * outScale));
    const h = Math.max(1, Math.round(info.h * outScale));
    const canvas = makeCanvas(w, h);
    const bmp = await createImageBitmap(frames[0].blob);
    canvas.getContext('2d').drawImage(bmp, info.x * scale, info.y * scale, info.w * scale, info.h * scale, 0, 0, w, h);
    bmp.close();
    return { canvases: [canvas], outScale, cssW: info.w, cssH: info.h };
  }

  const { rect, viewportW: vw, viewportH: vh } = info;
  const B = rect.T + rect.H;
  const last = frames.length - 1;
  const sLast = frames[last].scrollTop;
  const cssH = vh + sLast;
  const outScale = Math.min(scale, MAX_SIDE / vw);
  const W = Math.round(vw * outScale);
  const H = Math.round(cssH * outScale);

  // Draw operations in CSS px: [frame, sx, sy, sw, sh, dx, dy]
  const ops = [];
  frames.forEach((f, i) => {
    if (i === 0) ops.push([0, 0, 0, vw, B, 0, 0]);
    else ops.push([i, rect.L, rect.T, rect.W, rect.H, rect.L, rect.T + f.scrollTop]);
  });
  if (vh > B) ops.push([last, 0, B, vw, vh - B, 0, B + sLast]);

  const nParts = Math.ceil(H / MAX_SIDE);
  const partH = Math.ceil(H / nParts);
  const canvases = [];
  for (let p = 0; p < nParts; p++) {
    const oy = p * partH;
    const h = Math.min(partH, H - oy);
    const canvas = makeCanvas(W, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, h);
    let cached = { i: -1, bmp: null };
    for (const [i, sx, sy, sw, sh, dx, dy] of ops) {
      const top = dy * outScale - oy;
      const bottom = (dy + sh) * outScale - oy;
      if (bottom <= 0 || top >= h) continue;
      if (cached.i !== i) {
        if (cached.bmp) cached.bmp.close();
        cached = { i, bmp: await createImageBitmap(frames[i].blob) };
      }
      ctx.drawImage(cached.bmp,
        Math.round(sx * scale), Math.round(sy * scale), Math.round(sw * scale), Math.round(sh * scale),
        Math.round(dx * outScale), Math.round(top), Math.round(sw * outScale), Math.round(sh * outScale));
    }
    if (cached.bmp) cached.bmp.close();
    canvases.push(canvas);
  }
  return { canvases, outScale, cssW: vw, cssH };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------- rendering & annotation ----------

function drawShape(ctx, s, k, source) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 4 * k;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (s.type === 'rect') {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  } else if (s.type === 'arrow') {
    const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const head = 20 * k;
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const bx = s.x2 - Math.cos(ang) * Math.min(head * 0.8, len);
    const by = s.y2 - Math.sin(ang) * Math.min(head * 0.8, len);
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(bx, by); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x2, s.y2);
    ctx.lineTo(s.x2 - head * Math.cos(ang - 0.45), s.y2 - head * Math.sin(ang - 0.45));
    ctx.lineTo(s.x2 - head * Math.cos(ang + 0.45), s.y2 - head * Math.sin(ang + 0.45));
    ctx.closePath(); ctx.fill();
  } else if (s.type === 'text') {
    ctx.font = `700 ${22 * k}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.lineWidth = 5 * k;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    s.text.split('\n').forEach((line, i) => {
      const y = s.y + i * 26 * k;
      ctx.strokeText(line, s.x, y);
      ctx.fillText(line, s.x, y);
    });
  } else if (s.type === 'blur') {
    const x = Math.max(0, Math.round(s.x));
    const y = Math.max(0, Math.round(s.y));
    const w = Math.min(source.width - x, Math.round(s.w));
    const h = Math.min(source.height - y, Math.round(s.h));
    if (w > 0 && h > 0) {
      const block = Math.max(6, Math.round(10 * k));
      const tiny = makeCanvas(Math.max(1, Math.ceil(w / block)), Math.max(1, Math.ceil(h / block)));
      const tctx = tiny.getContext('2d');
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(source, x, y, w, h, 0, 0, tiny.width, tiny.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
    }
  }
  ctx.restore();
}

function renderPart(part) {
  const ctx = part.canvas.getContext('2d');
  ctx.drawImage(part.base, 0, 0);
  for (const s of part.shapes) drawShape(ctx, s, part.scale, part.canvas);
}

function normRect(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function addShape(part, shape) {
  part.shapes.push(shape);
  drawShape(part.canvas.getContext('2d'), shape, part.scale, part.canvas);
  state.history.push(state.parts.indexOf(part));
  $('#undo').disabled = false;
}

function undo() {
  const idx = state.history.pop();
  if (idx === undefined) return;
  const part = state.parts[idx];
  part.shapes.pop();
  renderPart(part);
  $('#undo').disabled = state.history.length === 0;
}

function toCanvasPoint(part, e) {
  const r = part.canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * part.canvas.width) / r.width,
    y: ((e.clientY - r.top) * part.canvas.height) / r.height,
  };
}

function setPreview(part, shape) {
  const svg = part.svg;
  svg.innerHTML = '';
  if (!shape) return;
  const k = part.scale;
  const ns = 'http://www.w3.org/2000/svg';
  let el;
  if (shape.type === 'arrow') {
    el = document.createElementNS(ns, 'line');
    Object.entries({ x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2 }).forEach(([a, v]) => el.setAttribute(a, v));
  } else {
    el = document.createElementNS(ns, 'rect');
    Object.entries({ x: shape.x, y: shape.y, width: shape.w, height: shape.h }).forEach(([a, v]) => el.setAttribute(a, v));
    if (shape.type === 'blur') {
      el.setAttribute('fill', 'rgba(100,116,139,.35)');
      el.setAttribute('stroke-dasharray', `${6 * k} ${4 * k}`);
    }
  }
  el.setAttribute('stroke', shape.type === 'blur' ? '#475569' : shape.color);
  el.setAttribute('stroke-width', 4 * k);
  el.setAttribute('stroke-linecap', 'round');
  if (shape.type !== 'blur') el.setAttribute('fill', 'none');
  svg.appendChild(el);
}

function startText(part, pt) {
  const frame = part.canvas.parentElement;
  const r = part.canvas.getBoundingClientRect();
  const ratio = r.width / part.canvas.width; // screen px per canvas px
  const input = document.createElement('textarea');
  input.className = 'text-input';
  input.rows = 1;
  input.style.left = `${pt.x * ratio}px`;
  input.style.top = `${pt.y * ratio}px`;
  input.style.color = state.color;
  input.style.fontSize = `${22 * part.scale * ratio}px`;
  input.placeholder = 'Type, then Enter';
  let done = false;
  const commit = (keep) => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    input.remove();
    if (keep && text) addShape(part, { type: 'text', x: pt.x, y: pt.y, text, color: state.color });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true); }
    if (e.key === 'Escape') commit(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => commit(true));
  frame.appendChild(input);
  input.focus();
}

function wirePart(part) {
  const frame = part.canvas.parentElement;
  let start = null;
  let current = null;
  frame.addEventListener('pointerdown', (e) => {
    if (!state.annotating || e.button !== 0 || e.target.classList.contains('text-input')) return;
    const pt = toCanvasPoint(part, e);
    if (state.tool === 'text') { e.preventDefault(); startText(part, pt); return; }
    start = pt;
    frame.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  frame.addEventListener('pointermove', (e) => {
    if (!start) return;
    const pt = toCanvasPoint(part, e);
    current = state.tool === 'arrow'
      ? { type: 'arrow', x1: start.x, y1: start.y, x2: pt.x, y2: pt.y, color: state.color }
      : { type: state.tool, ...normRect(start, pt), color: state.color };
    setPreview(part, current);
  });
  const end = () => {
    if (!start) return;
    start = null;
    setPreview(part, null);
    const s = current;
    current = null;
    if (!s) return;
    const big = s.type === 'arrow' ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6 : s.w > 4 && s.h > 4;
    if (big) addShape(part, s);
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);
}

// ---------- output ----------

function fileBase() {
  const { info, createdAt } = state.job;
  let host = 'page';
  try { host = new URL(info.url).hostname.replace(/^www\./, '') || 'page'; } catch { /* keep */ }
  const d = new Date(createdAt);
  const pad = (n) => String(n).padStart(2, '0');
  return `stitchly-${host}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const canvasBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality);
});

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function downloadPng(index) {
  const list = index === undefined ? state.parts.map((_, i) => i) : [index];
  for (const i of list) {
    const suffix = state.parts.length > 1 ? `-part${i + 1}` : '';
    saveBlob(await canvasBlob(state.parts[i].canvas), `${fileBase()}${suffix}.png`);
  }
  toast(list.length > 1 ? `Saving ${list.length} PNG files` : 'PNG saved to your downloads');
}

async function copyPart(index = 0) {
  try {
    const blob = canvasBlob(state.parts[index].canvas);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(state.parts.length > 1 ? `Copied part ${index + 1} of ${state.parts.length}` : 'Copied to clipboard');
  } catch (e) {
    console.error(e);
    toast('Copy failed: click the page first, then try again');
  }
}

async function downloadPdf() {
  if (!state.pro) return upsell('pdf');
  const pages = [];
  for (const part of state.parts) {
    const jpeg = new Uint8Array(await (await canvasBlob(part.canvas, 'image/jpeg', 0.92)).arrayBuffer());
    let pageWidth = (part.canvas.width / part.scale) * 0.75; // CSS px → points
    let pageHeight = (part.canvas.height / part.scale) * 0.75;
    const fit = Math.min(1, 14400 / pageWidth, 14400 / pageHeight); // PDF page size limit
    pageWidth *= fit; pageHeight *= fit;
    pages.push({ jpeg, width: part.canvas.width, height: part.canvas.height, pageWidth, pageHeight });
  }
  saveBlob(buildPdf(pages), `${fileBase()}.pdf`);
  toast('PDF saved to your downloads');
}

// ---------- Pro gating ----------

function proUrl() {
  return LICENSE_CONFIG.buyUrl || chrome.runtime.getURL('options.html?why=pro');
}

function upsell(feature) {
  const note = $('#up-note');
  note.textContent = LICENSE_CONFIG.buyUrl ? '' : 'Pro is coming soon. Check the options page for updates.';
  $('#upsell').dataset.feature = feature || '';
  $('#upsell').showModal();
}

function applyPro() {
  for (const btn of document.querySelectorAll('[data-pro]')) {
    const lock = btn.querySelector('.lock');
    if (state.pro) { btn.removeAttribute('data-locked'); if (lock) lock.remove(); btn.title = ''; }
    else {
      btn.setAttribute('data-locked', '');
      btn.title = 'Pro feature';
      if (!lock) btn.insertAdjacentHTML('beforeend', LOCK_SVG);
    }
  }
  $('#getpro').hidden = state.pro;
  if (!state.pro && state.annotating) setAnnotating(false);
}

async function refreshPro() {
  try { state.pro = await isPro(); } catch { state.pro = false; }
  applyPro();
}

function setAnnotating(on) {
  if (on && !state.pro) return upsell('annotate');
  state.annotating = on;
  $('#tools').hidden = !on;
  $('#annotate').classList.toggle('active', on);
  document.body.classList.toggle('annotating', on);
  return undefined;
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  document.body.classList.toggle('tool-text', tool === 'text');
}

function wireUi() {
  $('#download').addEventListener('click', () => downloadPng());
  $('#copy').addEventListener('click', () => copyPart(0));
  $('#pdf').addEventListener('click', () => downloadPdf());
  $('#annotate').addEventListener('click', () => setAnnotating(!state.annotating));
  $('#done').addEventListener('click', () => setAnnotating(false));
  $('#undo').addEventListener('click', undo);
  $('#zoom-in').addEventListener('click', () => stepZoom(1));
  $('#zoom-out').addEventListener('click', () => stepZoom(-1));
  $('#getpro').addEventListener('click', () => upsell(''));
  $('#up-buy').addEventListener('click', () => { window.open(proUrl(), '_blank'); $('#upsell').close(); });
  $('#up-key').addEventListener('click', () => { window.open(chrome.runtime.getURL('options.html'), '_blank'); $('#upsell').close(); });
  document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
    state.color = b.dataset.color;
    document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === b));
  }));
  document.addEventListener('keydown', (e) => {
    if (!state.annotating || e.target.closest('textarea,input')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    const keys = { r: 'rect', a: 'arrow', t: 'text', b: 'blur' };
    if (!e.ctrlKey && !e.metaKey && keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
    if (e.key === 'Escape') setAnnotating(false);
  });
  chrome.storage.onChanged.addListener((changes) => { if (changes.license) refreshPro(); });
}

// ---------- boot ----------

async function main() {
  wireUi();
  const params = new URLSearchParams(location.search);
  if (params.get('error')) { showError(params.get('error'), params.get('from')); return; }
  const proReady = refreshPro();
  const job = params.get('job') ? await loadJob(params.get('job')) : null;
  if (!job) { showError('missing'); return; }
  state.job = job;

  const { info } = job;
  let host = '';
  try { host = new URL(info.url).hostname; } catch { /* ignore */ }
  document.title = `Stitchly · ${info.title || host || 'Capture'}`;

  const { canvases, outScale, cssW, cssH } = await stitch(job);
  const meta = $('#meta');
  meta.innerHTML = '<strong></strong><span></span>';
  meta.querySelector('strong').textContent = info.title || host || 'Capture';
  const totalPx = canvases.reduce((n, c) => n + c.height, 0);
  meta.querySelector('span').textContent = `${host ? `${host} · ` : ''}${canvases[0].width} × ${totalPx.toLocaleString()} px`
    + `${job.kind === 'region' ? ' · selected region' : ''}${info.isDoc === false ? ` · scrolled ${info.scroller}` : ''}`;

  const notes = [];
  if (canvases.length > 1) notes.push(`This page is ${Math.round(cssH).toLocaleString()} px tall, which is more than one image can hold in Chrome (16,384 px), so it was saved as ${canvases.length} images that join top to bottom.`);
  if (job.truncated) notes.push('The page kept growing as Stitchly scrolled (infinite scroll), so the capture stopped after a very long section.');
  if (notes.length) { $('#notice').textContent = notes.join(' '); $('#notice').hidden = false; }

  const container = $('#parts');
  canvases.forEach((base, i) => {
    const wrap = document.createElement('section');
    wrap.className = 'part';
    if (canvases.length > 1) {
      const head = document.createElement('div');
      head.className = 'part-head';
      head.innerHTML = `<span>Part ${i + 1} of ${canvases.length}</span><span><button class="btn" data-act="png">Download</button> <button class="btn" data-act="copy">Copy</button></span>`;
      head.querySelector('[data-act=png]').addEventListener('click', () => downloadPng(i));
      head.querySelector('[data-act=copy]').addEventListener('click', () => copyPart(i));
      wrap.appendChild(head);
    }
    const frame = document.createElement('div');
    frame.className = 'frame';
    const canvas = makeCanvas(base.width, base.height);
    canvas.getContext('2d').drawImage(base, 0, 0);
    canvas.style.width = `${base.width / outScale}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'preview');
    svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    frame.append(canvas, svg);
    wrap.appendChild(frame);
    container.appendChild(wrap);
    const part = { base, canvas, svg, shapes: [], scale: outScale, cssW };
    state.parts.push(part);
    wirePart(part);
  });

  setZoom(1);
  $('#status').hidden = true;
  $('#actions').hidden = false;
  await proReady;
  document.body.dataset.ready = '1';
}

// Read by the automated tests only.
window.stitchlyResult = state;

main().catch((e) => { console.error(e); showError('failed'); });
