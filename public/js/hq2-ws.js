// HQ as a workspace (views/partials/hq2-ws.ejs): the jump-to box (Cmd/Ctrl K or "/") over every page and workflow,
// and Ask 127 opening the talk bar where the page has one. Every link works without this file.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var pal = $('[data-ws-palette]'), q = $('[data-ws-q]'), list = $('[data-ws-list]');
  if (!pal) return;
  var items = [];
  try { items = JSON.parse($('#ws-items').textContent); } catch (e) { items = []; }
  var flows = null, sel = 0, shown = [];

  // Workflows come once, the first time the box opens.
  var loadFlows = function () {
    if (flows) return;
    flows = [];
    fetch('/app/hq/palette.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : { workflows: [] }; })
      .then(function (j) { flows = (j.workflows || []).map(function (w) { return { t: w.title, h: '/app/hq/w/' + encodeURIComponent(w.id), k: w.pack, lock: w.locked }; }); draw(); })
      .catch(function () {});
  };
  // Every word typed must start a word in the title or its group; earlier and shorter matches first.
  var score = function (it, words) {
    var hay = (it.t + ' ' + (it.k || '')).toLowerCase(), s = 0;
    for (var i = 0; i < words.length; i++) {
      var at = hay.indexOf(words[i]);
      if (at < 0) return -1;
      s += (at === 0 || hay.charAt(at - 1) === ' ' ? 10 : 2) - at / 100;
    }
    return s - it.t.length / 200;
  };
  var draw = function () {
    var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    var all = items.map(function (i) { return Object.assign({ page: true }, i); }).concat(flows || []);
    shown = words.length
      ? all.map(function (it) { return { it: it, s: score(it, words) }; }).filter(function (x) { return x.s >= 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 9).map(function (x) { return x.it; })
      : all.filter(function (i) { return i.page; });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.textContent = '';
    if (!shown.length) {
      var none = document.createElement('li'); none.className = 'ws-pal-none';
      none.textContent = 'Nothing by that name. Try Ask 127 instead.'; list.appendChild(none); return;
    }
    shown.forEach(function (it, i) {
      var li = document.createElement('li'), a = document.createElement('a');
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      a.href = it.h; a.className = 'ws-pal-item' + (i === sel ? ' on' : '');
      var t = document.createElement('span'); t.textContent = it.t;
      var k = document.createElement('small'); k.textContent = it.page ? 'Page' : (it.k || 'Workflow') + (it.lock ? ' · Builder' : '');
      a.appendChild(t); a.appendChild(k); li.appendChild(a); list.appendChild(li);
      a.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
    });
  };
  var mark = function () {
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      if (li.firstChild && li.firstChild.classList) li.firstChild.classList.toggle('on', i === sel);
    });
    var on = list.children[sel]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  };
  var last = null;
  var open = function () {
    last = document.activeElement; pal.hidden = false; document.documentElement.classList.add('ws-locked');
    q.value = ''; sel = 0; draw(); loadFlows(); setTimeout(function () { q.focus(); }, 10);
  };
  var close = function () { pal.hidden = true; document.documentElement.classList.remove('ws-locked'); if (last && last.focus) last.focus(); };

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-ws-jump]')) { e.preventDefault(); open(); return; }
    if (!pal.hidden && e.target === pal) close();
    var ask = e.target.closest('[data-ws-ask]'), talk = $('#talk-in');
    if (ask && talk) { e.preventDefault(); talk.scrollIntoView({ block: 'center', behavior: 'smooth' }); talk.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (pal.hidden) open(); else close(); return; }
    if (e.key === '/' && !typing && pal.hidden) { e.preventDefault(); open(); return; }
    if (pal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); location.href = shown[sel].h; }
    else if (e.key === 'Tab') { e.preventDefault(); q.focus(); }
  });
  q.addEventListener('input', function () { sel = 0; draw(); });
  if (location.hash === '#talk' && $('#talk-in')) $('#talk-in').focus();
  // Mac shows the Command key; everyone else Ctrl.
  if (!/Mac|iPhone|iPad/.test(navigator.platform || '')) Array.prototype.forEach.call(document.querySelectorAll('.ws-jump kbd'), function (k) { k.textContent = 'Ctrl K'; });
})();
