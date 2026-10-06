// Snipkey content script.
// Watches what you type for a known shortcut and replaces it with the snippet text.
// Privacy: it never reads page content beyond the few characters right before the caret
// (to compare with your shortcuts), and never sends anything anywhere. Password fields are ignored.
(() => {
  'use strict';
  if (window.__snipkeyLoaded) return;
  window.__snipkeyLoaded = true;

  const FREE_LIMIT = 10;
  const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
  const WORD_CHAR = /[\p{L}\p{N}_]/u;

  let snippets = [];
  let pro = false;
  let byLastChar = new Map(); // last character of shortcut -> snippets, longest shortcut first
  let maxLen = 0;
  let busy = false;

  // ---------- state ----------

  function rebuildIndex() {
    const active = pro ? snippets : snippets.slice(0, FREE_LIMIT);
    const map = new Map();
    let longest = 0;
    for (const s of active) {
      if (!s || typeof s.shortcut !== 'string' || s.shortcut.length < 2 || typeof s.text !== 'string') continue;
      const last = s.shortcut[s.shortcut.length - 1];
      if (!map.has(last)) map.set(last, []);
      map.get(last).push(s);
      longest = Math.max(longest, s.shortcut.length);
    }
    for (const list of map.values()) list.sort((a, b) => b.shortcut.length - a.shortcut.length);
    byLastChar = map;
    maxLen = longest;
  }

  function extensionAlive() {
    try { return Boolean(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  function refreshPro() {
    if (!extensionAlive()) return;
    try {
      chrome.runtime.sendMessage({ type: 'snipkey:isPro' }, (res) => {
        void chrome.runtime.lastError;
        pro = Boolean(res && res.pro);
        rebuildIndex();
      });
    } catch { /* extension reloaded */ }
  }

  chrome.storage.local.get('snippets', (res) => {
    snippets = Array.isArray(res.snippets) ? res.snippets : [];
    rebuildIndex();
  });
  refreshPro();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.snippets) {
      snippets = Array.isArray(changes.snippets.newValue) ? changes.snippets.newValue : [];
      rebuildIndex();
    }
    if (area === 'sync' && changes.license) refreshPro();
  });

  // ---------- matching ----------

  function findMatch(before) {
    const list = byLastChar.get(before[before.length - 1]);
    if (!list) return null;
    for (const s of list) {
      if (!before.endsWith(s.shortcut)) continue;
      // A shortcut that starts with a letter/digit (e.g. "brb") must not be the tail of a longer word.
      if (WORD_CHAR.test(s.shortcut[0])) {
        const prev = before[before.length - s.shortcut.length - 1];
        if (prev && WORD_CHAR.test(prev)) continue;
      }
      return s;
    }
    return null;
  }

  function isTextField(el) {
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      return TEXT_INPUT_TYPES.has(type) && el.type !== 'password' && !el.readOnly && !el.disabled;
    }
    return false;
  }

  function caretOf(el) {
    let start = null;
    try { start = el.selectionStart; } catch { /* e.g. type=email */ }
    if (start == null) return { pos: el.value.length, selectable: false };
    if (start !== el.selectionEnd) return null;
    return { pos: start, selectable: true };
  }

  // Text of the caret's text node plus contiguous previous text nodes in the same block, up to n chars.
  function ceTextBefore(host, n) {
    const sel = host.ownerDocument.getSelection();
    if (!sel || sel.rangeCount !== 1 || !sel.isCollapsed) return null;
    let node = sel.focusNode;
    let offset = sel.focusOffset;
    if (!node || !host.contains(node)) return null;
    if (node.nodeType !== Node.TEXT_NODE) {
      const prev = node.childNodes[offset - 1];
      if (!prev || prev.nodeType !== Node.TEXT_NODE) return null;
      node = prev;
      offset = prev.data.length;
    }
    const segments = [{ node, end: offset }];
    let text = node.data.slice(0, offset);
    if (text.length >= n) return { text, segments, caretNode: node, caretOffset: offset };
    const block = blockOf(node, host);
    const walker = host.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    walker.currentNode = node;
    while (text.length < n) {
      const prev = walker.previousNode();
      if (!prev || prev === block) break;
      if (prev.nodeType === Node.ELEMENT_NODE) {
        if (prev.tagName === 'BR' || isBlock(prev)) break;
        continue;
      }
      segments.unshift({ node: prev, end: prev.data.length });
      text = prev.data + text;
    }
    return { text, segments, caretNode: node, caretOffset: offset };
  }

  function isBlock(el) {
    const d = getComputedStyle(el).display;
    return d !== 'inline' && d !== 'inline-block' && d !== 'contents';
  }

  function blockOf(node, host) {
    let el = node.parentElement;
    while (el && el !== host && !isBlock(el)) el = el.parentElement;
    return el && host.contains(el) ? el : host;
  }

  // Range covering the last `len` characters of the collected segments.
  function ceRangeForTail(ctx, len) {
    let remaining = len;
    for (let i = ctx.segments.length - 1; i >= 0; i--) {
      const seg = ctx.segments[i];
      if (seg.end >= remaining) {
        const range = document.createRange();
        range.setStart(seg.node, seg.end - remaining);
        range.setEnd(ctx.caretNode, ctx.caretOffset);
        return range;
      }
      remaining -= seg.end;
    }
    return null;
  }

  // ---------- input listener ----------

  document.addEventListener('input', (e) => {
    if (busy || !byLastChar.size || e.isComposing) return;
    if (e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') return;
    const el = e.composedPath ? e.composedPath()[0] : e.target;
    if (!(el instanceof Element)) return;

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (!isTextField(el)) return; // includes password fields: never touched
      const caret = caretOf(el);
      if (!caret || caret.pos === 0) return;
      if (!byLastChar.has(el.value[caret.pos - 1])) return;
      const before = el.value.slice(Math.max(0, caret.pos - maxLen - 1), caret.pos);
      const snip = findMatch(before);
      if (!snip) return;
      const start = caret.pos - snip.shortcut.length;
      queueMicrotask(() => expandInField(el, snip, start, caret.pos, caret.selectable));
      return;
    }

    const host = el.isContentEditable ? el : null;
    if (!host) return;
    // Cheap pre-check before any DOM walking: does the character before the caret end a shortcut?
    const sel = host.ownerDocument.getSelection();
    if (!sel || !sel.focusNode) return;
    const fNode = sel.focusNode;
    const fPrev = fNode.nodeType === Node.TEXT_NODE ? fNode.data[sel.focusOffset - 1] : (() => {
      const n = fNode.childNodes[sel.focusOffset - 1];
      return n && n.nodeType === Node.TEXT_NODE ? n.data[n.data.length - 1] : undefined;
    })();
    if (!fPrev || !byLastChar.has(fPrev)) return;
    const ctx = ceTextBefore(host, maxLen + 1);
    if (!ctx || !ctx.text || !byLastChar.has(ctx.text[ctx.text.length - 1])) return;
    const snip = findMatch(ctx.text);
    if (!snip) return;
    const range = ceRangeForTail(ctx, snip.shortcut.length);
    if (!range) return;
    queueMicrotask(() => expandInEditable(host, snip, range));
  }, true);

  // ---------- placeholders ----------

  const TOKEN = /\{(date|time|clipboard|cursor|input:([^{}]{1,40}))\}/g;

  // Resolves placeholders. Returns { text, cursor } or null if the user cancelled the fill-in dialog.
  async function renderSnippet(raw) {
    const fields = [];
    for (const m of raw.matchAll(TOKEN)) if (m[2] && !fields.includes(m[2].trim())) fields.push(m[2].trim());
    let values = {};
    if (fields.length) {
      if (pro) {
        values = await askFields(fields);
        if (!values) return null;
      } else {
        for (const f of fields) values[f] = `[${f}]`; // fill-in fields are Pro; leave a visible marker
      }
    }
    let clip = '';
    if (raw.includes('{clipboard}')) clip = await readClipboard();
    const now = new Date();
    let cursor = -1;
    let out = '';
    let last = 0;
    for (const m of raw.matchAll(TOKEN)) {
      out += raw.slice(last, m.index);
      last = m.index + m[0].length;
      const key = m[1];
      if (key === 'date') out += now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      else if (key === 'time') out += now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      else if (key === 'clipboard') out += clip;
      else if (key === 'cursor') { if (cursor < 0) cursor = out.length; }
      else out += values[m[2].trim()] ?? '';
    }
    out += raw.slice(last);
    return { text: out, cursor: cursor < 0 ? out.length : cursor };
  }

  async function readClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      return typeof t === 'string' ? t : '';
    } catch {
      return ''; // clipboard unavailable here (permission, focus or policy): skip gracefully
    }
  }

  const needsAsync = (raw) => raw.includes('{clipboard}') || /\{input:/.test(raw);

  // ---------- replacing in <input>/<textarea> ----------

  async function expandInField(el, snip, start, end, selectable) {
    busy = true;
    try {
      const rendered = await renderSnippet(snip.text);
      if (needsAsync(snip.text)) el.focus();
      if (!rendered || el.value.slice(start, end) !== snip.shortcut) return; // cancelled or text changed meanwhile
      const original = el.value;
      const expected = original.slice(0, start) + rendered.text + original.slice(end);
      let ok = false;
      if (selectable) {
        try {
          el.setSelectionRange(start, end);
          // execCommand keeps the browser's undo stack (Ctrl+Z restores the shortcut) and fires real input events.
          ok = el.ownerDocument.execCommand('insertText', false, rendered.text);
        } catch { ok = false; }
      }
      if (!ok || el.value === original) {
        // Fallback for fields where execCommand is unavailable (e.g. type=email) and controlled (React) inputs:
        // set through the native setter so framework value trackers notice, then fire an input event.
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, expected);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: rendered.text }));
      }
      if (selectable) {
        const caret = start + rendered.cursor;
        try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
      }
    } finally {
      busy = false;
    }
  }

  // ---------- replacing in contenteditable ----------

  async function expandInEditable(host, snip, range) {
    busy = true;
    try {
      const rendered = await renderSnippet(snip.text);
      if (needsAsync(snip.text)) host.focus();
      if (!rendered || range.toString() !== snip.shortcut) return;
      const doc = host.ownerDocument;
      const sel = doc.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const lines = rendered.text.split('\n');
      let ok = true;
      if (lines[0] === '') ok = doc.execCommand('delete', false);
      lines.forEach((line, i) => {
        if (!ok) return;
        if (i > 0) ok = doc.execCommand('insertLineBreak', false) || doc.execCommand('insertParagraph', false);
        if (ok && line) ok = doc.execCommand('insertText', false, line);
      });
      if (!ok && range.toString() === snip.shortcut) manualInsert(host, range, rendered.text);
      const tail = rendered.text.length - rendered.cursor;
      if (tail > 0 && sel.modify) for (let i = 0; i < tail; i++) sel.modify('move', 'backward', 'character');
    } finally {
      busy = false;
    }
  }

  function manualInsert(host, range, text) {
    const doc = host.ownerDocument;
    range.deleteContents();
    const frag = doc.createDocumentFragment();
    text.split('\n').forEach((line, i) => {
      if (i > 0) frag.appendChild(doc.createElement('br'));
      if (line) frag.appendChild(doc.createTextNode(line));
    });
    const lastNode = frag.lastChild;
    range.insertNode(frag);
    if (lastNode) {
      const sel = doc.getSelection();
      const r = doc.createRange();
      r.setStartAfter(lastNode);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    host.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  }

  // ---------- fill-in dialog (Pro) ----------

  function askFields(fields) {
    return new Promise((resolve) => {
      const hostEl = document.createElement('div');
      hostEl.id = 'snipkey-fill-host';
      hostEl.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
      const root = hostEl.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { all: initial; }
          .backdrop { position: fixed; inset: 0; background: rgba(15, 18, 40, .28); display: flex; align-items: center; justify-content: center; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
          form { background: #fff; color: #1d2033; border-radius: 12px; box-shadow: 0 18px 50px rgba(0,0,0,.28); padding: 18px 20px 16px; width: min(360px, calc(100vw - 32px)); box-sizing: border-box; }
          h2 { margin: 0 0 2px; font-size: 15px; font-weight: 650; }
          p { margin: 0 0 12px; color: #636780; font-size: 12.5px; }
          label { display: block; font-size: 12.5px; font-weight: 600; margin: 10px 0 4px; }
          input { width: 100%; box-sizing: border-box; font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid #cfd2e3; border-radius: 8px; outline: none; color: inherit; background: #fff; }
          input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.18); }
          .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
          button { font: inherit; font-weight: 600; border-radius: 8px; padding: 7px 14px; cursor: pointer; border: 1px solid #cfd2e3; background: #fff; color: #1d2033; }
          button[type=submit] { background: #4f46e5; border-color: #4f46e5; color: #fff; }
          @media (prefers-color-scheme: dark) {
            form { background: #22243a; color: #eceefb; }
            p { color: #a6a9c4; }
            input, button { background: #2c2f4a; border-color: #44486b; color: #eceefb; }
          }
        </style>
        <div class="backdrop">
          <form part="dialog" role="dialog" aria-modal="true" aria-label="Fill in snippet">
            <h2>Fill in snippet</h2>
            <p>Enter to insert · Esc to cancel</p>
            <div class="fields"></div>
            <div class="row"><button type="button" class="cancel">Cancel</button><button type="submit">Insert</button></div>
          </form>
        </div>`;
      const box = root.querySelector('.fields');
      fields.forEach((name, i) => {
        const label = document.createElement('label');
        label.textContent = name;
        const input = document.createElement('input');
        input.name = `f${i}`;
        input.autocomplete = 'off';
        input.spellcheck = false;
        label.appendChild(input);
        box.appendChild(label);
      });
      const form = root.querySelector('form');
      let done = false;
      const finish = (val) => {
        if (done) return;
        done = true;
        hostEl.remove();
        resolve(val);
      };
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const out = {};
        fields.forEach((name, i) => { out[name] = form.elements[`f${i}`].value; });
        finish(out);
      });
      root.querySelector('.cancel').addEventListener('click', () => finish(null));
      root.querySelector('.backdrop').addEventListener('mousedown', (ev) => { if (ev.target === ev.currentTarget) finish(null); });
      // Keep keystrokes inside the dialog away from page shortcuts (e.g. webmail hotkeys).
      for (const type of ['keydown', 'keyup', 'keypress']) {
        hostEl.addEventListener(type, (ev) => {
          if (type === 'keydown' && ev.key === 'Escape') { ev.preventDefault(); finish(null); }
          ev.stopPropagation();
        });
      }
      document.documentElement.appendChild(hostEl);
      setTimeout(() => { const first = root.querySelector('input'); if (first) first.focus(); }, 0);
    });
  }
})();
