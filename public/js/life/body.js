// Life · Daily check-in (lib/life, held until Legal clears `body`): sleep, water, steps, energy and an optional
// weight, one entry a day, with each one's 7-day average and 30-day line. Kept in the member's browser only.
// Data: { unit: 'lb' | 'kg', days: { 'YYYY-MM-DD': { sleep, water, steps, energy, weight } } }.
(function () {
  'use strict';
  var L = window.Life, el = L.el, svg = L.svg;
  var METRICS = [
    { k: 'sleep', label: 'Sleep', post: 'h', max: 24, fmt: L.one },
    { k: 'water', label: 'Water', post: 'cups', max: 40, fmt: L.one },
    { k: 'steps', label: 'Steps', max: 100000, int: true, fmt: L.count },
    { k: 'energy', label: 'Energy', max: 5, fmt: L.one },
    { k: 'weight', label: 'Weight', max: 1500, fmt: L.one },
  ];
  var d = null, day = L.today();

  function clean(x) {
    x = x || {};
    var out = { unit: x.unit === 'kg' ? 'kg' : 'lb', days: {} };
    var ds = x.days && typeof x.days === 'object' ? x.days : {};
    Object.keys(ds).sort().slice(-800).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !ds[k] || typeof ds[k] !== 'object') return;
      var e = {};
      METRICS.forEach(function (m) { var v = ds[k][m.k]; if (v !== '' && v != null && isFinite(L.num(v))) e[m.k] = Math.min(m.max, Math.max(0, L.num(v))); });
      if (e.energy != null) e.energy = Math.max(1, Math.round(e.energy));
      if (Object.keys(e).length) out.days[k] = e;
    });
    return out;
  }
  function example() {
    var o = { unit: 'lb', days: {} };
    for (var i = 29; i >= 0; i--) {
      var k = L.addDays(L.today(), -i), w = (i * 7) % 5;
      o.days[k] = { sleep: 6.5 + (w % 3) * 0.5, water: 5 + (i % 4), steps: 6200 + ((i * 1370) % 5200), energy: 2 + ((i + 1) % 4), weight: 182 - i * 0.05 + (w - 2) * 0.3 };
      if (i % 3) delete o.days[k].weight;
    }
    return o;
  }
  function commit(redraw) { L.save(d); if (redraw) draw(); else drawSoon(); }
  function entry() { return d.days[day] || (d.days[day] = {}); }
  function set(k, v) {
    var e = entry();
    if (v === '' || v == null) delete e[k]; else e[k] = v;
    if (!Object.keys(e).length) delete d.days[day];
  }

  function line(m) {
    var W = 220, H = 44, pts = [];
    for (var i = 29; i >= 0; i--) { var k = L.addDays(day, -i), v = (d.days[k] || {})[m.k]; if (v != null) pts.push([29 - i, v, k]); }
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + (H + 8), class: 'bd-line', 'aria-hidden': 'true' });
    if (pts.length < 2) return g;
    var lo = Math.min.apply(null, pts.map(function (p) { return p[1]; })), hi = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    if (hi === lo) { hi += 1; lo -= 1; }
    var x = function (i) { return 4 + (i / 29) * (W - 8); }, y = function (v) { return 4 + H - ((v - lo) / (hi - lo)) * H; };
    g.appendChild(svg('path', { d: pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' '), class: 'ln' }));
    var last = pts[pts.length - 1];
    if (last[2] === day) g.appendChild(svg('circle', { cx: x(last[0]), cy: y(last[1]), r: 3.5, class: 'is-lit' }));
    return g;
  }
  function avg(k) {
    var s = 0, n = 0;
    for (var i = 0; i < 7; i++) { var v = (d.days[L.addDays(day, -i)] || {})[k]; if (v != null) { s += v; n += 1; } }
    return n ? s / n : NaN;
  }

  function draw() {
    var root = L.root;
    var focusId = document.activeElement && document.activeElement.id;
    root.innerHTML = '';
    var e = d.days[day] || {};
    root.appendChild(el('div', { class: 'lf-month' }, [
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Previous day', text: '‹', onclick: function () { day = L.addDays(day, -1); draw(); } }),
      el('span', { class: 'lf-month-n', text: day === L.today() ? 'Today' : L.day(day) }),
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Next day', text: '›', disabled: day >= L.today() ? true : null, onclick: function () { day = L.addDays(day, 1); draw(); } }),
    ]));

    var water = e.water || 0;
    root.appendChild(el('section', { class: 'lf-panel bd-today' }, [
      el('div', { class: 'bd-grid' }, [
        L.field({ id: 'bd-sleep', label: 'Sleep last night', post: 'hours', value: e.sleep != null ? e.sleep : '', blank: true, onInput: function (v) { set('sleep', v === '' ? '' : Math.min(24, v)); commit(); } }),
        el('div', { class: 'lf-f' }, [el('span', { class: 'lf-f-l', text: 'Water' }), el('div', { class: 'bd-step' }, [
          el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'One cup less', text: '−', disabled: water ? null : true, onclick: function () { set('water', water > 1 ? water - 1 : ''); commit(true); } }),
          el('b', { text: L.one(water) + (water === 1 ? ' cup' : ' cups') }),
          el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'One cup more', text: '+', onclick: function () { set('water', Math.min(40, water + 1)); commit(true); } }),
        ])]),
        L.field({ id: 'bd-steps', label: 'Steps', int: true, value: e.steps != null ? e.steps : '', blank: true, onInput: function (v) { set('steps', v === '' ? '' : Math.min(100000, Math.round(v))); commit(); } }),
        L.field({ id: 'bd-weight', label: 'Weight (optional)', post: d.unit, value: e.weight != null ? e.weight : '', blank: true, onInput: function (v) { set('weight', v === '' ? '' : Math.min(1500, v)); commit(); } }),
      ]),
      el('div', null, [el('span', { class: 'lf-f-l', text: 'Energy today' }), L.choice({ label: 'Energy today', options: [[1, '1 Drained'], [2, '2'], [3, '3 OK'], [4, '4'], [5, '5 Great']], value: e.energy, onPick: function (v) { set('energy', e.energy === v ? '' : v); commit(true); } })]),
      el('div', { class: 'bd-unit' }, [el('span', { class: 'lf-f-l', text: 'Weight in' }), L.choice({ label: 'Weight unit', options: [['lb', 'lb'], ['kg', 'kg']], value: d.unit, onPick: function (v) { d.unit = v; commit(true); } })]),
    ]));

    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Last 30 days' }),
      el('div', { class: 'bd-trends' }, METRICS.map(function (m) {
        var a = avg(m.k);
        return el('div', { class: 'bd-trend' }, [
          el('span', { class: 'lf-k', text: m.label }),
          el('b', { text: isFinite(a) ? m.fmt(a) + (m.k === 'weight' ? ' ' + d.unit : m.post ? ' ' + m.post : '') : '–' }),
          el('span', { class: 'lf-d', text: '7-day average' }),
          line(m),
        ]);
      })),
    ]));
    if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) { f.focus(); if (f.setSelectionRange && f.type === 'text') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  }
  var soon = null;
  function drawSoon() { clearTimeout(soon); soon = setTimeout(draw, 500); }

  d = L.state.keep ? clean(L.load()) : example();
  L.current = function () { return d; };
  L.onData = function (x) { d = clean(x); day = L.today(); draw(); };
  draw();
})();
