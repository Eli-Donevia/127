// Shared pieces for the native HQ tools (lib/tools): reading the page's state, saving as the member types, number
// formats, small DOM and SVG builders, and number tweens. Each tool's own script (public/js/tools/<id>.js) draws
// the page with these. No libraries; everything reads complete with reduced motion.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stateEl = document.getElementById('tool-state');
  var state = stateEl ? JSON.parse(stateEl.textContent || '{}') : {};
  var root = document.getElementById('tool');
  var savedEl = document.getElementById('tool-saved');

  // ---------- formats ----------
  function money(n, dp) {
    if (!isFinite(n)) return '–';
    var neg = n < 0, a = Math.abs(n);
    var d = dp != null ? dp : a >= 100 || Math.round(a) === a ? 0 : 2;
    return (neg ? '−$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function count(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–'; }
  function pct(n, dp) {
    if (!isFinite(n)) return '–';
    var d = dp != null ? dp : n < 10 ? 1 : 0;
    return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, '')); return isFinite(x) ? x : 0; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(iso) { var p = String(iso).split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // The Monday of the week a date is in.
  function monday(d) { d = new Date(d || Date.now()); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function addDays(isoDay, n) { var d = new Date(isoDay + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }

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

  // A number field: a label, the value set large in mono, a prefix or suffix. onInput gets the number.
  function field(o) {
    var input = el('input', {
      class: 'tl-in', type: 'text', inputmode: o.int ? 'numeric' : 'decimal', autocomplete: 'off', spellcheck: 'false',
      value: o.value == null || o.value === '' ? '' : String(o.value), placeholder: o.placeholder || '0', 'aria-label': o.aria || o.label,
      disabled: o.disabled || null,
    });
    var wrap = el('label', { class: 'tl-f' + (o.big ? ' big' : '') + (o.cls ? ' ' + o.cls : '') }, [
      o.label ? el('span', { class: 'tl-f-l', text: o.label }) : null,
      el('span', { class: 'tl-f-v' }, [o.pre ? el('span', { class: 'tl-f-a', text: o.pre }) : null, input, o.post ? el('span', { class: 'tl-f-a', text: o.post }) : null]),
      o.hint ? el('span', { class: 'tl-f-h', text: o.hint }) : null,
    ]);
    input.addEventListener('input', function () {
      input.value = input.value.replace(o.neg ? /[^\d.,\-]/g : /[^\d.,]/g, '');
      o.onInput(num(input.value));
    });
    // Tabbing or tapping in selects the number to type over it; a tool putting focus back after a redraw doesn't.
    input.addEventListener('focus', function () { if (window.Tool.keepCaret) { window.Tool.keepCaret = false; return; } setTimeout(function () { input.select(); }, 0); });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      var step = o.step || (e.shiftKey ? 10 : 1), v = num(input.value) + (e.key === 'ArrowUp' ? step : -step);
      if (!o.neg) v = Math.max(0, v);
      input.value = String(Math.round(v * 100) / 100);
      o.onInput(num(input.value));
    });
    wrap.input = input;
    return wrap;
  }
  // A plain text field.
  function text(o) {
    var input = el('input', { class: 'tl-tx', type: 'text', value: o.value || '', placeholder: o.placeholder || '', maxlength: o.max || 50, 'aria-label': o.aria || o.placeholder, disabled: o.disabled || null });
    input.addEventListener('input', function () { o.onInput(input.value); });
    return input;
  }

  // Tween a number shown in an element; fmt turns the number into text.
  function tween(node, to, fmt) {
    var from = node._v == null ? to : node._v;
    node._v = to;
    if (reduce || from === to || !isFinite(from) || !isFinite(to)) { node.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 520;
    cancelAnimationFrame(node._raf);
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      node.textContent = fmt(from + (to - from) * e);
      if (k < 1) node._raf = requestAnimationFrame(step);
    })(t0);
  }

  // ---------- saving ----------
  var timer = null, inFlight = false, again = null, tries = 0;
  function say(t, cls) { if (savedEl) { savedEl.textContent = t; savedEl.className = 'tl-saved' + (cls ? ' ' + cls : ''); } }
  function post(data) {
    inFlight = true;
    say('Saving');
    fetch('/app/hq/tools/' + root.getAttribute('data-tool') + '/data', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(data),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not save'); return j; });
    }).then(function () {
      tries = 0;
      var d = new Date();
      say('Saved ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), 'ok');
    }).catch(function (e) {
      tries += 1;
      say(e.message + (tries < 4 ? '. Trying again.' : '.'), 'bad');
      if (tries < 4 && !again) again = data;
    }).then(function () {
      inFlight = false;
      if (again) { var d = again; again = null; setTimeout(function () { post(d); }, tries ? 1500 * tries : 0); }
    });
  }
  function save(data) {
    if (!state.canSave) return;
    say('Editing');
    clearTimeout(timer);
    timer = setTimeout(function () { if (inFlight) again = data; else post(data); }, 650);
  }
  window.addEventListener('beforeunload', function (e) { if (timer && savedEl && /Editing|Saving/.test(savedEl.textContent)) { e.preventDefault(); e.returnValue = ''; } });

  // Draw-in for SVG paths and bars once they enter the view: once per key a page load, so redraws as the member
  // types don't replay it.
  var shown = {};
  function reveal(node, k) {
    if (reduce || !('IntersectionObserver' in window) || shown[k]) return;
    shown[k] = 1;
    node.classList.add('tl-pre');
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { node.classList.remove('tl-pre'); io.disconnect(); } }); }, { threshold: 0.2 });
    io.observe(node);
  }

  window.Tool = { state: state, root: root, el: el, svg: svg, field: field, text: text, tween: tween, save: save, reveal: reveal, money: money, count: count, pct: pct, num: num, day: day, iso: iso, monday: monday, addDays: addDays, reduce: reduce };
})();
