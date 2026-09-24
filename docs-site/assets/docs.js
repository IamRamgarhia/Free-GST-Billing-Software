/* Free GST Billing docs - search, menu, theme, copy buttons, contents highlight.
   No libraries; works from any folder. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- phone menu ---- */
  var side = $('#sidebar'), scrim = $('.scrim'), menuBtn = $('.menu-btn');
  function setMenu(open) {
    if (!side) return;
    side.classList.toggle('open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu');
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(!side.classList.contains('open')); });
  if (scrim) scrim.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  // keep the current page visible in a long sidebar
  var current = $('.sidebar a[aria-current="page"]');
  if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });

  /* ---- light / dark ---- */
  var themeBtn = $('.theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('fgb-docs-theme', root.dataset.theme); } catch (e) { /* private mode */ }
  });

  /* ---- copy buttons on commands ---- */
  $$('.ledger pre').forEach(function (pre) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = 'Copy';
    b.addEventListener('click', function () {
      var code = pre.innerText.replace(/Copy(ied)?$/, '').trim();
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () {
        b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600);
      }, function () { b.textContent = 'Select and copy'; });
    });
    pre.appendChild(b);
  });

  /* ---- "On this page": mark the section being read ---- */
  var tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var first = $$('.ledger section').filter(function (s) { return visible[s.id]; })[0];
      if (!first) return;
      tocLinks.forEach(function (a) { a.classList.remove('active'); });
      if (byId[first.id]) byId[first.id].classList.add('active');
    }, { rootMargin: '-70px 0px -55% 0px' });
    $$('.ledger section').forEach(function (s) { io.observe(s); });
  }

  /* ---- search ---- */
  var input = $('#q'), box = $('.results'), index = window.DOCS_INDEX || [];
  if (!input || !box) return;
  var sel = -1;
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function highlight(s, words) {
    var out = escapeHtml(s);
    words.forEach(function (w) {
      if (w.length < 2) return;
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }
  function snippet(t, words) {
    var low = t.toLowerCase(), at = -1;
    words.some(function (w) { at = low.indexOf(w); return at >= 0; });
    if (at < 0) return t.slice(0, 120);
    var start = Math.max(0, at - 40);
    return (start ? '…' : '') + t.slice(start, start + 140) + '…';
  }
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index.map(function (e) {
      var title = e.s.toLowerCase(), body = e.t.toLowerCase(), page = e.p.toLowerCase(), score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], hit = false;
        if (title.indexOf(w) >= 0) { score += title.indexOf(w) === 0 ? 12 : 8; hit = true; }
        if (page.indexOf(w) >= 0) { score += 3; hit = true; }
        if (body.indexOf(w) >= 0) { score += 2; hit = true; }
        if (!hit) return null;   // every word must appear somewhere
      }
      return { e: e, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
  }
  function render() {
    var q = input.value.trim();
    sel = -1;
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = search(q);
    box.innerHTML = hits.length ? hits.map(function (h, i) {
      return '<a role="option" id="r' + i + '" href="' + h.e.u + '"><span class="r-title">' + highlight(h.e.s, words) +
        '</span><span class="r-page">' + escapeHtml(h.e.p) + '</span><span class="r-text">' + highlight(snippet(h.e.t, words), words) + '</span></a>';
    }).join('') : '<p class="none">Nothing matches “' + escapeHtml(q) + '”. Try a shorter word, like “GSTIN” or “backup”.</p>';
    box.hidden = false;
  }
  function move(d) {
    var links = $$('a', box);
    if (!links.length) return;
    sel = (sel + d + links.length) % links.length;
    links.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === sel)); });
    links[sel].scrollIntoView({ block: 'nearest' });
  }
  input.addEventListener('input', render);
  input.addEventListener('focus', function () { if (input.value.trim()) render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      var links = $$('a', box), t = links[sel >= 0 ? sel : 0];
      if (t) { e.preventDefault(); window.location.href = t.getAttribute('href'); }
    } else if (e.key === 'Escape') { input.value = ''; render(); input.blur(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) box.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); input.focus();
    }
  });
})();
