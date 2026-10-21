// Shared pieces for Life in HQ (lib/life): the member's entries kept in their own browser, export and import as a
// file, delete from the device, number formats, dates, and small DOM and SVG builders. Each module's script
// (public/js/life/<id>.js) draws its page with these. Nothing here talks to 127's server. No libraries.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stateEl = document.getElementById('life-state');
  var state = stateEl ? JSON.parse(stateEl.textContent || '{}') : {};
  var root = document.getElementById('life');
  var mod = root ? root.getAttribute('data-mod') : null;
  var savedEl = document.getElementById('life-saved');

  // ---------- formats ----------
  function money(n, dp) {
    if (!isFinite(n)) return '–';
    var neg = n < 0, a = Math.abs(n);
    var d = dp != null ? dp : Math.round(a) === a || a >= 1000 ? 0 : 2;
    return (neg ? '−$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function count(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–'; }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, '')); return isFinite(x) ? x : 0; }
  function one(n) { return isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString('en-US') : '–'; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return iso(new Date()); }
  function day(s) { var p = String(s).split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function month(s) { return String(s).slice(0, 7); }
  function monthName(m) { var p = m.split('-'); return LONG[+p[1] - 1] + ' ' + p[0]; }
  function addMonths(m, n) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  // ---------- DOM ----------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  // A number field: label, value in mono, prefix or suffix. onInput gets the number (or '' when emptied, if o.blank).
  function field(o) {
    var input = el('input', {
      class: 'lf-in', type: 'text', inputmode: o.int ? 'numeric' : 'decimal', autocomplete: 'off', spellcheck: 'false', id: o.id || null,
      value: o.value == null || o.value === '' ? '' : String(o.value), placeholder: o.placeholder || '0', 'aria-label': o.aria || o.label,
    });
    var wrap = el('label', { class: 'lf-f' + (o.big ? ' big' : '') + (o.cls ? ' ' + o.cls : '') }, [
      o.label ? el('span', { class: 'lf-f-l', text: o.label }) : null,
      el('span', { class: 'lf-f-v' }, [o.pre ? el('span', { class: 'lf-f-a', text: o.pre }) : null, input, o.post ? el('span', { class: 'lf-f-a', text: o.post }) : null]),
      o.hint ? el('span', { class: 'lf-f-h', text: o.hint }) : null,
    ]);
    input.addEventListener('input', function () {
      input.value = input.value.replace(/[^\d.,]/g, '');
      o.onInput(o.blank && input.value === '' ? '' : num(input.value));
    });
    input.addEventListener('focus', function () { setTimeout(function () { input.select(); }, 0); });
    wrap.input = input;
    return wrap;
  }
  function text(o) {
    var input = el('input', { class: 'lf-tx', type: 'text', value: o.value || '', placeholder: o.placeholder || '', maxlength: o.max || 60, 'aria-label': o.aria || o.placeholder, id: o.id || null });
    input.addEventListener('input', function () { o.onInput(input.value); });
    return input;
  }
  // A row of choices; one is on. onPick gets the value.
  function choice(o) {
    var row = el('div', { class: 'lf-seg', role: 'group', 'aria-label': o.label });
    o.options.forEach(function (opt) {
      var v = Array.isArray(opt) ? opt[0] : opt, t = Array.isArray(opt) ? opt[1] : String(opt);
      var on = o.multi ? o.value.indexOf(v) >= 0 : o.value === v;
      row.appendChild(el('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': on ? 'true' : 'false', text: t, onclick: function () { o.onPick(v); } }));
    });
    return row;
  }
  function tween(node, to, fmt) {
    var from = node._v == null ? to : node._v;
    node._v = to;
    if (reduce || from === to || !isFinite(from) || !isFinite(to)) { node.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 480;
    cancelAnimationFrame(node._raf);
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      node.textContent = fmt(from + (to - from) * e);
      if (k < 1) node._raf = requestAnimationFrame(step);
    })(t0);
  }

  // ---------- the member's own storage ----------
  var KEY = state.scope && mod ? '127life:' + state.scope + ':' + mod : null;
  function say(t, cls) { if (savedEl) { savedEl.textContent = t; savedEl.className = 'lf-saved' + (cls ? ' ' + cls : ''); } }
  function load() {
    if (!KEY || !state.keep) return null;
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  var timer = null;
  function save(data) {
    if (!KEY || !state.keep) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        say('Kept on this device · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), 'ok');
      } catch (e) {
        say('This browser won\'t keep it (private window or storage full). Export to keep a copy.', 'bad');
      }
    }, 250);
  }

  var api = { state: state, root: root, mod: mod, el: el, svg: svg, field: field, text: text, choice: choice, tween: tween, load: load, save: save, say: say,
    money: money, count: count, num: num, one: one, iso: iso, today: today, day: day, addDays: addDays, month: month, monthName: monthName, addMonths: addMonths, uid: uid, reduce: reduce,
    // The module sets these: current() returns what to export, onData(data) redraws from imported or erased data.
    current: function () { return load(); }, onData: function () {} };
  window.Life = api;

  // ---------- footer: export, import, delete ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-life],[data-copy]');
    if (!b) return;
    var act = b.getAttribute('data-life');
    if (act === 'export') {
      var doc = { kind: '127-life', module: mod, version: 1, exported: new Date().toISOString(), data: api.current() };
      var url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
      var a = el('a', { href: url, download: '127-' + mod + '-' + today() + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      say('Exported. The file is on your device.', 'ok');
    } else if (act === 'erase') {
      if (!window.confirm('Delete everything in ' + document.title.split('·')[0].trim() + ' from this device? Export first if you want a copy.')) return;
      try { localStorage.removeItem(KEY); } catch (err) { /* nothing kept */ }
      api.onData(null);
      say('Deleted from this device.', 'ok');
    } else if (b.hasAttribute('data-copy')) {
      var src = document.getElementById(b.getAttribute('data-copy'));
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy prompt'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(src.textContent).then(done, function () { window.getSelection().selectAllChildren(src); });
      else window.getSelection().selectAllChildren(src);
    }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('[data-life="import"]')) return;
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2e6) { say('That file is too big to be a Life export.', 'bad'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var doc = JSON.parse(rd.result);
        if (!doc || doc.kind !== '127-life' || doc.module !== mod || !doc.data || typeof doc.data !== 'object') throw new Error('x');
        api.onData(doc.data);
        save(doc.data);
        say('Imported from ' + f.name + '.', 'ok');
      } catch (err) { say('That isn\'t an export from this page. Pick a file you exported here.', 'bad'); }
    };
    rd.readAsText(f);
  });
})();
