// The design rules, run inside the page by tests/design-check.mjs
// (page.evaluate(designAudit, opts)). Self-contained: no imports, no closures.
//
// a. no sideways page scroll       b. boxes never touch a line or each other
// c. controls never overlap         d. button / label text is never cut off
//
// Each problem names the elements by a data-dc attribute so the caller can
// outline them in red for its screenshot.
export function designAudit({ minGap, allow }) {
  const problems = [];
  let tag = 0;
  document.querySelectorAll('[data-dc]').forEach((e) => e.removeAttribute('data-dc'));
  const mark = (el) => {
    if (!el.dataset.dc) { tag += 1; el.dataset.dc = String(tag); }
    return el.dataset.dc;
  };
  const describe = (el) => {
    const bits = [];
    for (let e = el; e && e !== document.body && bits.length < 3; e = e.parentElement) {
      const cls = [...e.classList].filter((c) => !/^(flex|items-|justify-|gap-|mt-|mb-|p-)/.test(c)).slice(0, 2).join('.');
      bits.unshift(e.tagName.toLowerCase() + (cls ? `.${cls}` : '') + (e.getAttribute('role') ? `[role=${e.getAttribute('role')}]` : ''));
    }
    const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${bits.join(' > ')}${text ? ` "${text}"` : ''}`;
  };
  const add = (rule, els, detail) => problems.push({ rule, ids: els.map(mark), what: els.map(describe), detail });

  const vw = document.documentElement.clientWidth;
  const main = document.querySelector('.main-content');
  // Elements no rule looks at: the printed invoice sheet (a page, not the UI),
  // hidden helpers, SVG insides, and whatever the screen allowlists.
  const SKIP = ['.invoice-preview-container', '.preview-scaler', 'svg', '[aria-hidden="true"]', '.sidebar-backdrop', ...allow.skip].join(', ');
  const skipped = (el) => !!el.closest(SKIP);

  // The page scrollers do not clip: what is below the fold is still on the page.
  const PAGE_SCROLLERS = new Set([document.documentElement, document.body, main]);
  const visibleRect = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
    let [x1, y1, x2, y2] = [r.left, r.top, r.right, r.bottom];
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (PAGE_SCROLLERS.has(a)) continue;
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const ar = a.getBoundingClientRect();
        if (s.overflowX !== 'visible') { x1 = Math.max(x1, ar.left); x2 = Math.min(x2, ar.right); }
        if (s.overflowY !== 'visible') { y1 = Math.max(y1, ar.top); y2 = Math.min(y2, ar.bottom); }
      }
      if (s.position === 'fixed') break;
    }
    if (x2 - x1 < 1 || y2 - y1 < 1 || x2 <= 0) return null; // clipped away, or the closed phone menu
    return r;
  };

  // A layer: elements under the same absolute / fixed / sticky parent.
  // Things in different layers float over each other on purpose (a badge on
  // a button, the clear-x in a search box, a menu, a toolbar that stays put
  // while the page scrolls under it).
  const layerOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'absolute' || p === 'fixed' || p === 'sticky') return e;
    }
    return document.body;
  };
  // When a dialog is open, only the dialog is looked at.
  const overlays = [...document.querySelectorAll('.modal-overlay')].filter((o) => visibleRect(o));
  const root = overlays.length ? overlays[overlays.length - 1] : document.body;

  // ---- a. sideways scroll ------------------------------------------------
  const wide = [[document.documentElement, 'page'], [main, '.main-content']]
    .filter(([el]) => el && el.scrollWidth > el.clientWidth + 1);
  if (wide.length) {
    const limit = Math.min(vw, main ? main.getBoundingClientRect().right : vw);
    const culprits = [...(main || document.body).querySelectorAll('*')].filter((el) => {
      if (skipped(el)) return false;
      // Inside a box that scrolls sideways on purpose (a table, the invoice buttons row).
      for (let a = el.parentElement; a && a !== main; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.right <= limit + 1) return false;
      const parent = el.parentElement.getBoundingClientRect();
      return parent.right <= limit + 1 || el.parentElement === main; // the one that sticks out
    }).slice(0, 3);
    add('sideways-scroll', culprits, `${wide.map(([el, n]) => `${n} is ${el.scrollWidth}px wide in ${el.clientWidth}px`).join('; ')}`);
  }

  // ---- collect boxes and lines ---------------------------------------------
  const CONTROL = 'button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select, textarea, [role=tab], a.btn';
  const CLICKABLE = 'button, a[href], input, select, textarea, [role=tab], [role=button]';
  const visibleColor = (c) => c && c !== 'transparent' && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(c);
  const borderOn = (s, side) => parseFloat(s[`border${side}Width`]) >= 1 && s[`border${side}Style`] !== 'none' && visibleColor(s[`border${side}Color`]);
  const isBox = (el, s) => {
    if (el.matches(CONTROL)) return true;
    if (s.display === 'inline' || s.display === 'contents' || s.display.startsWith('table')) return false;
    const framed = ['Top', 'Right', 'Bottom', 'Left'].every((side) => borderOn(s, side));
    const filled = visibleColor(s.backgroundColor) && parseFloat(s.borderTopLeftRadius) >= 3;
    return framed || filled;
  };

  const boxes = [];
  const lines = [];
  for (const el of root.querySelectorAll('*')) {
    if (skipped(el)) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    const inCell = el.closest('td, th');
    const box = isBox(el, s);
    if (!box && !inCell && !el.closest('table')) {
      for (const side of ['Top', 'Bottom']) {
        if (!borderOn(s, side)) continue;
        const r = visibleRect(el);
        if (r && r.width >= 24) lines.push({ el, layer: layerOf(el), side, y: side === 'Top' ? r.top : r.bottom, x1: r.left, x2: r.right });
      }
    }
    if (!box) continue;
    const r = visibleRect(el);
    if (!r) continue;
    boxes.push({ el, r, layer: layerOf(el), cell: inCell, click: el.matches(CLICKABLE) });
  }

  // Joined on purpose: a segmented control / input group (allowlist).
  const joined = (a, b) => allow.joined.some((sel) => {
    const g = a.el.closest(sel);
    return g && g.contains(b.el);
  });
  const related = (a, b) => a.contains(b) || b.contains(a);
  // Rounding: a 4px CSS gap can measure 3.99px.
  const tooClose = (gap) => gap < minGap - 0.5;
  const fmt = (n) => `${Math.round(n * 10) / 10}px`;

  // ---- b. a box touching a line ------------------------------------------
  for (const L of lines) {
    for (const B of boxes) {
      if (related(L.el, B.el) || B.cell || L.layer !== B.layer) continue;
      if (Math.min(L.x2, B.r.right) - Math.max(L.x1, B.r.left) <= 2) continue;
      const gap = L.side === 'Bottom' ? B.r.top - L.y : L.y - B.r.bottom;
      if (gap > -1.5 && tooClose(gap)) add('touches-line', [B.el, L.el], `${fmt(gap)} from the ${L.side.toLowerCase()} border line of the second element (needs ${minGap}px)`);
    }
  }

  // ---- b + c. boxes touching / overlapping each other ----------------------
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const A = boxes[i]; const B = boxes[j];
      if (A.layer !== B.layer || related(A.el, B.el) || A.cell !== B.cell || joined(A, B)) continue;
      const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ox > 1 && oy > 1) {
        add(A.click && B.click ? 'controls-overlap' : 'boxes-overlap', [A.el, B.el], `overlap ${fmt(ox)} x ${fmt(oy)}`);
      } else if (ox > 2 && tooClose(-oy)) {
        add('boxes-touch', [A.el, B.el], `${fmt(-oy)} apart, one above the other (needs ${minGap}px)`);
      } else if (oy > 2 && tooClose(-ox)) {
        add('boxes-touch', [A.el, B.el], `${fmt(-ox)} apart, side by side (needs ${minGap}px)`);
      }
    }
  }

  // ---- d. text cut off ----------------------------------------------------
  for (const el of root.querySelectorAll('button, label, [role=tab], a.btn, .stat-label, .status-badge, .status-pill')) {
    if (skipped(el) || !el.textContent.trim()) continue;
    const r = visibleRect(el);
    if (!r) continue;
    const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis') continue;
    let cut = 0;
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) cut = el.scrollWidth - el.clientWidth;
    else if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) cut = el.scrollHeight - el.clientHeight;
    else {
      // The text itself, leaving out floating parts (a count badge on a bell).
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || layerOf(t.parentElement) !== layerOf(el)) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        const tr = range.getBoundingClientRect();
        if (tr.width) cut = Math.max(cut, tr.right - r.right, r.left - tr.left);
      }
    }
    if (cut > 1) add('text-cut', [el], `text is ${fmt(cut)} wider/taller than its box, with no ellipsis`);
  }

  return problems;
}
