// Life · Food log (lib/life, held until Legal clears `food`): the member's own daily target, foods logged from the
// starter list (content/life/foods.json, rounded USDA values) or their own, and the last seven days. Kept in the
// member's browser only. No calculator asks for weight, height or age: the target is the member's own number.
// Data: { target, protein, mine: [food], days: { 'YYYY-MM-DD': [{ id, name, serving, qty, kcal, protein, carbs, fat, meal }] } }.
(function () {
  'use strict';
  var L = window.LifeKit('food'), el = L.el;
  var MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
  var STARTER = (L.state.foods && L.state.foods.foods) || [];
  var d = null, day = L.today(), q = '', qty = 1, meal = guessMeal(), adding = false, ringHost = null, ringApi = null, ringKey = '';

  function guessMeal() { var h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }
  function food(f) {
    return { id: String(f.id || L.uid()).slice(0, 24), name: String(f.name || '').slice(0, 60), serving: String(f.serving || '').slice(0, 40),
      kcal: Math.min(5000, Math.max(0, L.num(f.kcal))), protein: Math.min(500, Math.max(0, L.num(f.protein))), carbs: Math.min(500, Math.max(0, L.num(f.carbs))), fat: Math.min(500, Math.max(0, L.num(f.fat))) };
  }
  function clean(x) {
    x = x || {};
    var out = { target: Math.min(10000, Math.max(0, L.num(x.target))), protein: Math.min(500, Math.max(0, L.num(x.protein))), started: !!x.started, mine: [], days: {} };
    out.mine = (Array.isArray(x.mine) ? x.mine : []).slice(0, 300).map(food).filter(function (f) { return f.name; });
    var ds = x.days && typeof x.days === 'object' ? x.days : {};
    Object.keys(ds).sort().slice(-400).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(ds[k])) return;
      out.days[k] = ds[k].slice(0, 80).map(function (e) {
        var f = food(e);
        f.qty = Math.min(20, Math.max(0.25, L.num(e.qty) || 1));
        f.meal = MEALS.some(function (m) { return m[0] === e.meal; }) ? e.meal : 'snacks';
        return f;
      }).filter(function (e) { return e.name; });
    });
    return out;
  }
  function example() {
    var by = {}; STARTER.forEach(function (f) { by[f.id] = f; });
    var pick = function (id, n, mealId) { var f = food(by[id] || { name: id }); f.id = L.uid(); f.qty = n; f.meal = mealId; return f; };
    // No target in the example: the member types their own, and 127 never suggests one (Legal L87 LV4).
    var o = { target: 0, protein: 0, started: true, mine: [], days: {} };
    var plan = [['egg', 2, 'breakfast'], ['oats', 1, 'breakfast'], ['blueberries', 0.5, 'breakfast'], ['coffee', 1, 'breakfast'], ['chicken-breast', 1.5, 'lunch'], ['white-rice', 1, 'lunch'], ['broccoli', 1, 'lunch'], ['greek-yogurt', 1, 'snacks'], ['salmon', 1.5, 'dinner'], ['potato', 1, 'dinner']];
    for (var i = 6; i >= 0; i--) {
      var k = L.addDays(L.today(), -i);
      o.days[k] = plan.filter(function (p, j) { return i === 0 ? j < 8 : (j + i) % 7 !== 0; }).map(function (p) { return pick(p[0], p[1], p[2]); });
    }
    return o;
  }
  function sum(list) {
    var t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    (list || []).forEach(function (e) { t.kcal += e.kcal * e.qty; t.protein += e.protein * e.qty; t.carbs += e.carbs * e.qty; t.fat += e.fat * e.qty; });
    return t;
  }
  function commit() { L.save(d); draw(); }

  function start() {
    var t = '', p = '';
    return el('div', { class: 'lf-start' }, [
      el('p', { class: 'lf-start-q', text: 'What\'s your daily target?' }),
      el('p', { class: 'lf-start-s', text: 'Use your own number, from your doctor, a dietitian or a calculator you trust. You can change it any time, or log without one.' }),
      el('div', { class: 'lf-two' }, [
        L.field({ label: 'Calories a day', id: 'fd-t0', big: true, int: true, onInput: function (v) { t = v; } }),
        L.field({ label: 'Protein a day (optional)', id: 'fd-p0', big: true, post: 'g', int: true, onInput: function (v) { p = v; } }),
      ]),
      el('div', { class: 'lf-start-b' }, [
        el('button', { type: 'button', class: 'lf-go', text: 'Start logging', onclick: function () { d.target = L.num(t); d.protein = L.num(p); d.started = true; commit(); } }),
        el('button', { type: 'button', class: 'lf-act', text: 'Log without a target', onclick: function () { d.started = true; commit(); } }),
      ]),
    ]);
  }

  // Last 14 days as bars with the 7-day average and the member's target; today lit.
  function week(host) {
    var pts = [], avg = [];
    for (var i = 13; i >= 0; i--) { var k = L.addDays(day, -i), t = sum(d.days[k]); pts.push({ label: L.day(k), y: d.days[k] ? Math.round(t.kcal) : null, note: d.days[k] ? Math.round(t.protein) + ' g protein' : null }); }
    pts.forEach(function (p, j) { var w = pts.slice(Math.max(0, j - 6), j + 1).filter(function (x) { return x.y != null; }); avg.push(w.length >= 3 ? w.reduce(function (n, x) { return n + x.y; }, 0) / w.length : null); });
    setTimeout(function () { L.chart(host, { key: 'fd-week', kind: 'bar', points: pts, avg: avg, target: d.target || null, targetLabel: 'Target', lit: 13, height: 180, unit: 'cal', aria: 'Calories, last 14 days', fmt: L.count }); }, 0);
  }
  function notes() {
    var out = [], logged = 0, protLow = 0, kcal = [];
    for (var i = 0; i < 7; i++) { var k = L.addDays(L.today(), -i), list = d.days[k]; if (!list) continue; logged++; var t = sum(list); kcal.push(t.kcal); if (d.protein && t.protein < d.protein * 0.8) protLow++; }
    if (d.protein && logged >= 4 && protLow >= 4) out.push({ tone: 'caution', title: 'Protein under target ' + protLow + ' of ' + logged + ' days', body: 'Your target is ' + L.count(d.protein) + ' g. A protein food at each meal closes most of the gap.' });
    if (d.target && kcal.length >= 4) {
      var a = kcal.reduce(function (n, v) { return n + v; }, 0) / kcal.length, diff = (a - d.target) / d.target;
      if (Math.abs(diff) >= 0.1) out.push({ tone: 'info', title: 'This week averages ' + L.count(a) + ' a day', body: L.count(Math.abs(a - d.target)) + (diff > 0 ? ' above' : ' below') + ' your ' + L.count(d.target) + ' target, across ' + kcal.length + ' logged days.' });
      else out.push({ tone: 'good', title: 'Close to target this week', body: 'Averaging ' + L.count(a) + ' against ' + L.count(d.target) + '.' });
    }
    var streak = 0; for (var q = 0; q < 90; q++) { if (d.days[L.addDays(L.today(), -q)]) streak++; else break; }
    if (streak >= 5) out.push({ tone: 'good', title: streak + ' days logged in a row', body: null });
    return out;
  }

  function draw() {
    var root = L.root;
    var focusId = document.activeElement && document.activeElement.id;
    root.innerHTML = '';
    if (!d.started) { root.appendChild(start()); return; }
    var list = d.days[day] || [], t = sum(list);

    root.appendChild(el('div', { class: 'lf-month' }, [
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Previous day', text: '‹', onclick: function () { day = L.addDays(day, -1); draw(); } }),
      el('span', { class: 'lf-month-n', text: day === L.today() ? 'Today' : L.day(day) }),
      el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Next day', text: '›', disabled: day >= L.today() ? true : null, onclick: function () { day = L.addDays(day, 1); draw(); } }),
    ]));

    var hero = el('b', { class: 'lf-hero-v' });
    L.tween(hero, t.kcal, L.count);
    var left = d.target - t.kcal;
    root.appendChild(el('div', { class: 'lf-sum' }, [
      el('div', null, [el('span', { class: 'lf-k', text: 'Calories' }), hero,
        el('span', { class: 'lf-d', text: d.target ? (left >= 0 ? L.count(left) + ' left of ' + L.count(d.target) : L.count(-left) + ' past your ' + L.count(d.target) + ' target') : 'No target set' })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Protein' }), el('b', { text: L.count(t.protein) + ' g' }), el('span', { class: 'lf-d', text: d.protein ? 'of ' + L.count(d.protein) + ' g' : ' ' })]),
      el('div', { class: 'lf-stat' }, [el('span', { class: 'lf-k', text: 'Carbs · Fat' }), el('b', { text: L.count(t.carbs) + ' · ' + L.count(t.fat) }), el('span', { class: 'lf-d', text: 'grams' })]),
    ]));

    var rd = [];
    if (d.target) rd.push({ label: 'Calories', current: Math.round(t.kcal), target: d.target, unit: '', color: '#7c8cff', colorEnd: '#5be4ff' });
    if (d.protein) rd.push({ label: 'Protein', current: Math.round(t.protein), target: d.protein, unit: 'g', color: '#5be4ff', colorEnd: '#a6f0ff' });
    if (rd.length && L.rings) {
      var rk = rd.map(function (r) { return r.label + r.target; }).join('|') + day;
      if (!ringHost || rk !== ringKey) { ringHost = el('div', { class: 'bd-rings' }); ringApi = L.rings(ringHost, rd, { size: 120, stroke: 11, gap: 4 }); ringKey = rk; } else ringApi.update(rd);
      root.appendChild(ringHost);
    }
    L.notices(root, notes(), 3);

    // Add food: search the starter list and the member's own foods.
    var search = L.text({ id: 'fd-q', value: q, placeholder: 'Search foods, e.g. eggs, rice, salmon', max: 40, onInput: function (v) { q = v; drawSoon(); } });
    var hits = [];
    if (q.trim()) {
      var words = q.toLowerCase().split(/\s+/).filter(Boolean);
      hits = d.mine.map(function (f) { return [f, true]; }).concat(STARTER.map(function (f) { return [f, false]; }))
        .filter(function (p) { var n = p[0].name.toLowerCase(); return words.every(function (w) { return n.indexOf(w) >= 0; }); }).slice(0, 8);
    }
    function add(f) {
      var e = food(f); e.id = L.uid(); e.qty = Math.max(0.25, L.num(qty) || 1); e.meal = meal;
      (d.days[day] = d.days[day] || []).push(e);
      q = ''; commit();
      var s = document.getElementById('fd-q'); if (s) s.focus();
    }
    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Add food' }),
      L.choice({ label: 'Meal', options: MEALS, value: meal, onPick: function (v) { meal = v; draw(); } }),
      el('div', { class: 'fd-add' }, [search, L.field({ id: 'fd-qty', value: qty, label: 'Servings', cls: 'fd-qty', onInput: function (v) { qty = v || 1; } })]),
      hits.length ? el('ul', { class: 'fd-hits' }, hits.map(function (p) {
        var f = p[0];
        return el('li', null, [el('button', { type: 'button', onclick: function () { add(f); } }, [
          el('span', { class: 'fd-hit-n' }, [el('b', { text: f.name }), el('span', { text: f.serving + (p[1] ? ' · yours' : '') })]),
          el('span', { class: 'fd-hit-v', text: L.count(f.kcal) + ' cal' }),
        ])]);
      })) : q.trim() ? el('p', { class: 'lf-note-s', text: 'Not on the list yet. Add it as your own food below.' }) : null,
      el('button', { type: 'button', class: 'lf-act', text: adding ? 'Close' : 'Add your own food', onclick: function () { adding = !adding; draw(); } }),
      adding ? mine() : null,
    ]));

    // The day, by meal.
    root.appendChild(el('section', { class: 'lf-panel' }, MEALS.map(function (mm) {
      var rows = list.filter(function (e) { return e.meal === mm[0]; });
      if (!rows.length) return null;
      return el('div', { class: 'fd-meal' }, [
        el('h3', { class: 'lf-meal-h', text: mm[1] + ' · ' + L.count(sum(rows).kcal) }),
        el('ul', { class: 'lf-rows' }, rows.map(function (e) {
          return el('li', null, [
            el('span', { class: 'lf-rows-d', text: (e.qty === 1 ? '1' : L.one(e.qty)) + '×' }),
            el('span', { class: 'lf-rows-n' }, [el('b', { text: e.name }), el('span', { text: e.serving })]),
            el('span', { class: 'lf-rows-v', text: L.count(e.kcal * e.qty) }),
            el('button', { type: 'button', class: 'lf-ic', 'aria-label': 'Remove ' + e.name, text: '×', onclick: function () { d.days[day] = list.filter(function (x) { return x.id !== e.id; }); if (!d.days[day].length) delete d.days[day]; commit(); } }),
          ]);
        })),
      ]);
    }).filter(Boolean).concat(list.length ? [] : [el('p', { class: 'lf-note-s', text: 'Nothing logged ' + (day === L.today() ? 'today' : 'this day') + ' yet.' })])));

    root.appendChild(el('section', { class: 'lf-panel' }, [
      el('h2', { class: 'lf-h', text: 'Last two weeks' }), (function () { var h = el('div', { class: 'fd-chart' }); week(h); return h; })(),
      el('p', { class: 'lc-cap' }, [el('span', null, [el('i'), 'Calories']), el('span', null, [el('i', { class: 'avg' }), '7-day average']), d.target ? el('span', null, [el('i', { class: 'goal' }), 'Your target']) : null]),
      el('div', { class: 'lf-two' }, [
        L.field({ id: 'fd-t', label: 'Daily calorie target', value: d.target || '', int: true, onInput: function (v) { d.target = v; L.save(d); drawSoon(); } }),
        L.field({ id: 'fd-p', label: 'Daily protein target', value: d.protein || '', post: 'g', int: true, onInput: function (v) { d.protein = v; L.save(d); drawSoon(); } }),
      ]),
      el('p', { class: 'lf-note-s', text: (L.state.foods && L.state.foods.source) || '' }),
    ]));

    if (focusId) { var f = document.getElementById(focusId); if (f && f.focus) { f.focus(); if (f.setSelectionRange && f.type === 'text') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  }
  var soon = null;
  function drawSoon() { clearTimeout(soon); soon = setTimeout(draw, 250); }

  function mine() {
    var f = { name: '', serving: '', kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return el('div', { class: 'fd-mine' }, [
      L.text({ id: 'fd-mn', placeholder: 'Name, e.g. Mom\'s chili', onInput: function (v) { f.name = v; } }),
      L.text({ id: 'fd-ms', placeholder: 'Serving, e.g. 1 bowl', max: 40, onInput: function (v) { f.serving = v; } }),
      el('div', { class: 'fd-mine-g' }, [
        L.field({ label: 'Calories', int: true, onInput: function (v) { f.kcal = v; } }),
        L.field({ label: 'Protein', post: 'g', onInput: function (v) { f.protein = v; } }),
        L.field({ label: 'Carbs', post: 'g', onInput: function (v) { f.carbs = v; } }),
        L.field({ label: 'Fat', post: 'g', onInput: function (v) { f.fat = v; } }),
      ]),
      el('button', { type: 'button', class: 'lf-go', text: 'Save and add to ' + MEALS.filter(function (m) { return m[0] === meal; })[0][1].toLowerCase(), onclick: function () {
        if (!f.name.trim()) { var n = document.getElementById('fd-mn'); if (n) n.focus(); return; }
        var saved = food(f); saved.id = L.uid(); d.mine.unshift(saved); adding = false; addSaved(saved);
      } }),
    ]);
  }
  function addSaved(f) { var e = food(f); e.id = L.uid(); e.qty = Math.max(0.25, L.num(qty) || 1); e.meal = meal; (d.days[day] = d.days[day] || []).push(e); commit(); }

  d = L.state.keep ? clean(L.load()) : example();
  L.current = function () { return d; };
  L.onData = function (x) { d = clean(x); day = L.today(); draw(); };
  L.ready(draw);
})();
