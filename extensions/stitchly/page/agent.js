// Injected into the active tab (via activeTab + scripting) only while a capture runs.
// Finds the element that really scrolls, scrolls it step by step for the service worker,
// hides fixed/sticky elements that would repeat, then restores everything.
(() => {
  'use strict';
  if (window.__stitchly) return;

  let state = null;
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function canScroll(el) {
    if (el.scrollHeight <= el.clientHeight + 4 || el.clientHeight < 50) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
  }

  function documentScrolls(root) {
    if (root.scrollHeight <= root.clientHeight + 4) return false;
    const html = getComputedStyle(document.documentElement).overflowY;
    if (html === 'hidden' || html === 'clip') return false;
    if (html === 'visible' && document.body) {
      const body = getComputedStyle(document.body).overflowY;
      if (body === 'hidden' || body === 'clip') return false;
    }
    return true;
  }

  // The document's scroller if the page scrolls normally; otherwise the scrollable element
  // that covers the largest visible area (typical of web apps with a fixed shell).
  function findScroller() {
    const root = document.scrollingElement || document.documentElement;
    let best = null;
    let bestArea = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (!canScroll(el)) continue;
      const r = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (w * h > bestArea) { best = el; bestArea = w * h; }
    }
    const docScroll = documentScrolls(root) ? root.scrollHeight - root.clientHeight : 0;
    const bigEnough = best && bestArea > innerWidth * innerHeight * 0.25;
    // Prefer the inner element when the document barely scrolls but the inner element scrolls a lot.
    if (bigEnough && (docScroll < 40 || (best.scrollHeight - best.clientHeight) > docScroll * 4)) return best;
    return root;
  }

  function describe(el) {
    if (el === document.scrollingElement || el === document.documentElement) return 'document';
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    else if (el.classList.length) s += `.${[...el.classList].slice(0, 2).join('.')}`;
    return s;
  }

  function setHidden(item, hidden) {
    if (item.hidden === hidden) return;
    item.hidden = hidden;
    const st = item.el.style;
    if (hidden) {
      st.setProperty('opacity', '0', 'important');
      st.setProperty('transition', 'none', 'important');
    } else {
      st.setProperty('opacity', item.opacity[0], item.opacity[1]);
      st.setProperty('transition', item.transition[0], item.transition[1]);
    }
  }

  function prepare() {
    if (state) restore();
    const root = document.scrollingElement || document.documentElement;
    const el = findScroller();
    const isDoc = el === root;
    const quirks = document.compatMode === 'BackCompat';
    const vw = quirks ? innerWidth : document.documentElement.clientWidth;
    const vh = quirks ? innerHeight : document.documentElement.clientHeight;

    let rect;
    if (isDoc) {
      rect = { T: 0, L: 0, W: vw, H: vh };
    } else {
      const r = el.getBoundingClientRect();
      const T = Math.max(0, r.top + el.clientTop);
      const L = Math.max(0, r.left + el.clientLeft);
      const B = Math.min(vh, r.top + el.clientTop + el.clientHeight);
      const R = Math.min(vw, r.left + el.clientLeft + el.clientWidth);
      rect = { T, L, W: R - L, H: B - T };
    }

    const style = document.createElement('style');
    style.setAttribute('data-stitchly', '');
    style.textContent = '*,*::before,*::after{scroll-behavior:auto!important;caret-color:transparent!important}';
    (document.head || document.documentElement).appendChild(style);

    // Fixed/sticky elements that could repeat in every frame.
    const pinned = [];
    for (const node of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(node);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.display === 'none') continue;
      if (!isDoc && cs.position === 'sticky' && !el.contains(node)) continue;
      pinned.push({
        el: node,
        pos: cs.position,
        top: cs.top === 'auto' ? null : parseFloat(cs.top),
        bottom: cs.bottom === 'auto' ? null : parseFloat(cs.bottom),
        opacity: [node.style.getPropertyValue('opacity'), node.style.getPropertyPriority('opacity')],
        transition: [node.style.getPropertyValue('transition'), node.style.getPropertyPriority('transition')],
        hidden: false,
      });
    }

    state = {
      el, isDoc, rect, vw, vh, pinned, style,
      origWin: { x: scrollX, y: scrollY },
      origEl: { x: el.scrollLeft, y: el.scrollTop },
    };
    return {
      isDoc,
      scroller: describe(el),
      rect,
      viewportW: vw,
      viewportH: vh,
      innerWidth,
      innerHeight,
      dpr: devicePixelRatio,
      scrollHeight: el.scrollHeight,
      clientHeight: isDoc ? vh : el.clientHeight,
      pinnedCount: pinned.length,
      origScroll: isDoc ? state.origWin : state.origEl,
      title: document.title,
      url: location.href,
    };
  }

  // Decide which pinned elements are visible in frame `index` (isLast = no more scrolling).
  function applyPinned(index, isLast) {
    const { rect, el, isDoc } = state;
    const viewTop = isDoc ? 0 : el.getBoundingClientRect().top + el.clientTop;
    const viewBottom = viewTop + (isDoc ? state.vh : el.clientHeight);
    for (const item of state.pinned) {
      const r = item.el.getBoundingClientRect();
      let hide = false;
      if (item.pos === 'fixed') {
        const bottomAnchored = r.top >= rect.T + rect.H * 0.5;
        // Top bars only in the first frame, bottom bars only in the last frame.
        hide = bottomAnchored ? !isLast : index > 0;
      } else {
        const stuckTop = item.top !== null && Math.abs(r.top - (viewTop + item.top)) < 1.5;
        const stuckBottom = item.bottom !== null && Math.abs(r.bottom - (viewBottom - item.bottom)) < 1.5;
        hide = (index > 0 && stuckTop) || (!isLast && stuckBottom && !stuckTop);
      }
      setHidden(item, hide);
    }
  }

  async function scrollTo(y, index) {
    const { el } = state;
    el.scrollTop = y;
    if (state.isDoc) window.scrollTo(0, y);
    await raf();
    const max = el.scrollHeight - (state.isDoc ? state.vh : el.clientHeight);
    const top = el.scrollTop;
    const isLast = top >= max - 1;
    applyPinned(index, isLast);
    await raf();
    await raf();
    await sleep(30);
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, isLast };
  }

  function restore() {
    if (!state) return null;
    for (const item of state.pinned) setHidden(item, false);
    state.style.remove();
    const { el, isDoc, origWin, origEl } = state;
    el.scrollTop = origEl.y;
    el.scrollLeft = origEl.x;
    window.scrollTo(origWin.x, origWin.y);
    const result = { window: { x: scrollX, y: scrollY }, element: { x: el.scrollLeft, y: el.scrollTop }, isDoc };
    state = null;
    return result;
  }

  // Region selection overlay (Pro). Resolves with a viewport rect in CSS px, or null on Esc.
  function selectRegion() {
    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.setAttribute('data-stitchly', '');
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
      const shadow = host.attachShadow({ mode: 'closed' });
      shadow.innerHTML = `<style>
        .layer{position:fixed;inset:0;cursor:crosshair;background:rgba(15,23,42,.35);}
        .layer.dragging{background:transparent;}
        .box{position:fixed;display:none;outline:2px solid #fff;box-shadow:0 0 0 1px #0f766e,0 0 0 9999px rgba(15,23,42,.35);}
        .hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;
          font:500 14px/1.3 system-ui,sans-serif;padding:10px 16px;border-radius:999px;pointer-events:none;}
        .size{position:fixed;background:#0f172a;color:#fff;font:12px system-ui,sans-serif;padding:2px 6px;border-radius:4px;display:none;pointer-events:none}
      </style><div class="layer"></div><div class="box"></div><div class="size"></div>
      <div class="hint">Drag to select an area · Esc to cancel</div>`;
      const layer = shadow.querySelector('.layer');
      const box = shadow.querySelector('.box');
      const size = shadow.querySelector('.size');
      const hint = shadow.querySelector('.hint');
      let start = null;
      let rect = null;

      const finish = async (value) => {
        removeEventListener('keydown', onKey, true);
        host.remove();
        await raf(); await raf(); await sleep(50);
        resolve(value);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); } };
      addEventListener('keydown', onKey, true);

      layer.addEventListener('pointerdown', (e) => {
        start = { x: e.clientX, y: e.clientY };
        layer.setPointerCapture(e.pointerId);
        layer.classList.add('dragging');
        hint.style.display = 'none';
      });
      layer.addEventListener('pointermove', (e) => {
        if (!start) return;
        const x = Math.min(start.x, e.clientX);
        const y = Math.min(start.y, e.clientY);
        rect = { x, y, w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) };
        Object.assign(box.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
        Object.assign(size.style, { display: 'block', left: `${x}px`, top: `${Math.max(0, y - 22)}px` });
        size.textContent = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
      });
      layer.addEventListener('pointerup', () => {
        if (!start) return;
        start = null;
        if (!rect || rect.w < 4 || rect.h < 4) {
          layer.classList.remove('dragging');
          box.style.display = 'none';
          size.style.display = 'none';
          hint.style.display = '';
          rect = null;
          return;
        }
        finish({ ...rect, innerWidth, innerHeight, dpr: devicePixelRatio, title: document.title, url: location.href });
      });
      (document.body || document.documentElement).appendChild(host);
    });
  }

  window.__stitchly = { prepare, scrollTo, restore, selectRegion };
})();
