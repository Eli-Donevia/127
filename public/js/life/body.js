// Life · Daily check-in (lib/life, held until Legal clears `body`): sleep, water, steps, energy and an optional
// weight, one entry a day, with each one's 7-day average and 30-day line. Kept in the member's browser only.
// Data: { unit: 'lb' | 'kg', goals: { sleep, water, steps } (the member's own), days: { 'YYYY-MM-DD': { sleep, water, steps, energy, weight } } }.
// The chart shows 30 days and a 14-day forecast from the last 21 days' trend; flags mark streaks worth a look.
(function () {
  'use strict';
  var L = window.LifeKit('body'), el = L.el;
  var METRICS = [
    { k: 'sleep', label: 'Sleep', post: 'h', max: 24, fmt: L.one },
    { k: 'water', label: 'Water', post: 'cups', max: 40, fmt: L.one },
    { k: 'steps', label: 'Steps', max: 100000, int: true, fmt: L.count },
    { k: 'energy', label: 'Energy', max: 5, fmt: L.one },
    { k: 'weight', label: 'Weight', max: 1500, fmt: L.one },
  ];
  var d = null, day = L.today(), pick = 'sleep', ringHost = null, ringApi = null, ringKey = '';

  function clean(x) {
    x = x || {};
    var g = x.goals && typeof x.goals === 'object' ? x.goals : {};
    var out = { unit: x.unit === 'kg' ? 'kg' : 'lb', goals: { sleep: Math.min(14, Math.max(0, L.num(g.sleep))), water: Math.min(40, Math.max(0, L.num(g.water))), steps: Math.min(60000, Math.max(0, L.num(g.steps))) }, days: {} };
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
    var o = { unit: 'lb', goals: { sleep: 7.5, water: 8, steps: 8000 }, days: {} };
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


  function lastIdx(pts) { for (var i = Math.min(29, pts.length - 1); i >= 0; i--) if (pts[i].y != null) return i; return 0; }
  function val(k, key) { return (d.days[key] || {})[k]; }
  // Streak flags, newest first. Plain observations, never a diagnosis.
  function shortSleep(key) { var n = 0; for (var i = 0; i < 14; i++) { var v = val('sleep', L.addDays(key, -i)); if (v != null && v < 6) n++; else break; } return n; }
  function flagOn(k, key) {
    if (k === 'sleep' && shortSleep(key) >= 3) return 'Third short night or more in a row';
    if (k === 'water' && d.goals.water && val('water', key) != null && val('water', key) < d.goals.water * 0.5) return 'Under half your water goal';
    return null;
  }
  function flags() {
    var out = [], t = day;
    var ss = shortSleep(t);
    if (ss >= 3) out.push({ tone: 'caution', title: ss + ' short nights in a row', body: 'Under 6 hours since ' + L.day(L.addDays(t, -ss + 1)) + '. If it keeps up, an earlier block on the calendar can help.' });
    if (d.goals.water) {
      var low = 0, seen = 0;
      for (var i = 0; i < 7; i++) { var w = val('water', L.addDays(t, -i)); if (w != null) { seen++; if (w < d.goals.water) low++; } }
      if (seen >= 4 && low >= 4) out.push({ tone: 'caution', title: 'Water under goal ' + low + ' of the last ' + seen + ' days', body: 'Your goal is ' + d.goals.water + ' cups.' });
    }
    var en = [];
    for (var j = 13; j >= 0; j--) { var v = val('energy', L.addDays(t, -j)); if (v != null) en.push({ x: 13 - j, y: v }); }
    var f = L.fit ? L.fit(en) : null;
    if (f && en.length >= 7 && f.slope < -0.06) out.push({ tone: 'info', title: 'Energy is drifting down', body: 'About ' + L.one(-f.slope * 7) + ' points a week over the last two weeks. Look at sleep and training load together.' });
    var wt = [];
    for (var k = 20; k >= 0; k--) { var wv = val('weight', L.addDays(t, -k)); if (wv != null) wt.push({ x: 20 - k, y: wv }); }
    var fw = L.fit ? L.fit(wt) : null;
    if (fw && wt.length >= 5 && Math.abs(fw.slope * 7) >= 0.2) out.push({ tone: 'info', title: 'Weight is moving about ' + L.one(Math.abs(fw.slope * 7)) + ' ' + d.unit + ' a week', body: (fw.slope < 0 ? 'Down' : 'Up') + ' over the last three weeks.' });
    var streak = 0; for (var q = 0; q < 60; q++) { if (d.days[L.addDays(t, -q)]) streak++; else break; }
    if (streak >= 5) out.push({ tone: 'good', title: streak + ' days in a row checked in', body: null });
    return out;
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

    // Today against the member's own goals.
    var gl = d.goals, ringsData = [];
    if (gl.sleep) ringsData.push({ label: 'Sleep', current: L.one(e.sleep || 0), target: gl.sleep, unit: 'h', color: '#7c8cff', colorEnd: '#a9b4ff' });
    if (gl.water) ringsData.push({ label: 'Water', current: e.water || 0, target: gl.water, unit: 'cups', color: '#5be4ff', colorEnd: '#a6f0ff' });
    if (gl.steps) ringsData.push({ label: 'Steps', current: e.steps || 0, target: gl.steps, unit: '', color: '#86d6ad', colorEnd: '#b4ebcd' });
    ringsData.forEach(function (r) { r.current = +r.current || 0; });
    // One rings drawing kept across redraws: a change animates from where each ring stands instead of replaying.
    if (ringsData.length && L.rings) {
      var rk = ringsData.map(function (r) { return r.label + r.target; }).join('|');
      if (!ringHost || rk !== ringKey) { ringHost = el('div', { class: 'bd-rings' }); ringApi = L.rings(ringHost, ringsData, { size: 132, stroke: 11, gap: 4 }); ringKey = rk; }
      else ringApi.update(ringsData);
      root.insertBefore(ringHost, root.children[1]);
    }

    L.notices(root, flags(), 3);

    // The chart: pick a metric; 30 days, the 7-day average, and a 14-day forecast.
    var m = METRICS.filter(function (x) { return x.k === pick; })[0];
    var pts = [], avg = [];
    for (var i = 29; i >= -14; i--) {
      var k = L.addDays(day, -i), v = i >= 0 ? (d.days[k] || {})[m.k] : null;
      pts.push({ label: L.day(k), y: v == null ? null : v, flag: i >= 0 ? flagOn(m.k, k) : null });
    }
    for (var j = 0; j < pts.length; j++) { var w = pts.slice(Math.max(0, j - 6), j + 1).filter(function (p) { return p.y != null; }); avg.push(j < 30 && w.length >= 3 ? w.reduce(function (n, p) { return n + p.y; }, 0) / w.length : null); }
    var unit = m.k === 'weight' ? d.unit : m.post || '';
    var host = el('div', { class: 'bd-chart' });
    var line = el('span', { class: 'lf-d' });
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('div', { class: 'lf-panel-h' }, [el('h2', { class: 'lf-h', text: 'Trend' }), line]),
      el('div', { class: 'lc-tabs' }, [L.choice({ label: 'Metric', options: METRICS.map(function (x) { return [x.k, x.label]; }), value: pick, onPick: function (v) { pick = v; draw(); } })]),
      host,
      el('p', { class: 'lc-cap' }, [el('span', null, [el('i'), m.label]), el('span', null, [el('i', { class: 'avg' }), '7-day average']), el('span', null, [el('i', { class: 'dash' }), 'Next 14 days at this pace']), gl[m.k] ? el('span', null, [el('i', { class: 'goal' }), 'Your goal']) : null]),
      el('div', { class: 'bd-goals' }, [
        el('span', { class: 'lf-f-l', text: 'Your goals (optional)' }),
        el('div', { class: 'bd-grid' }, [
          L.field({ id: 'bd-g-sleep', label: 'Sleep', post: 'hours', value: gl.sleep || '', onInput: function (v) { gl.sleep = Math.min(14, v); L.save(d); drawSoon(); } }),
          L.field({ id: 'bd-g-water', label: 'Water', post: 'cups', value: gl.water || '', onInput: function (v) { gl.water = Math.min(40, v); L.save(d); drawSoon(); } }),
          L.field({ id: 'bd-g-steps', label: 'Steps', int: true, value: gl.steps || '', onInput: function (v) { gl.steps = Math.min(60000, Math.round(v)); L.save(d); drawSoon(); } }),
        ]),
      ]),
    ]));
    setTimeout(function () {
      var res = L.chart(host, { key: 'bd-' + m.k, kind: m.k === 'steps' || m.k === 'water' ? 'bar' : 'line', zero: m.k === 'weight' ? false : true, points: pts, avg: avg, target: gl[m.k] || null, targetLabel: 'Goal', lit: 29,
        forecast: { from: lastIdx(pts), window: 21, floor: 0, min: 6 }, unit: unit, height: 200, aria: m.label + ', last 30 days', fmt: m.fmt });
      var f = res.forecast;
      line.textContent = f.length > 1 ? 'In 14 days, about ' + m.fmt(f[f.length - 1].y) + (unit ? ' ' + unit : '') : 'Log a few more days for a forecast';
    }, 0);
    if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) { f.focus(); if (f.setSelectionRange && f.type === 'text') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  }
  var soon = null;
  function drawSoon() { clearTimeout(soon); soon = setTimeout(draw, 500); }

  d = L.state.keep ? clean(L.load()) : example();
  L.current = function () { return d; };
  L.onData = function (x) { d = clean(x); day = L.today(); draw(); };
  L.ready(draw);
})();
