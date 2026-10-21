// Cash runway (lib/tools 'cash'): cash today, money that repeats in and out, and one-offs on a given week; drawn as
// thirteen weeks of balance with the tightest week lit in Pop (the one thing on the page). Monthly lines land in the
// week that holds the 1st of the month. Saves { start, cash, ins, outs, once } as the member types.
(function () {
  'use strict';
  var T = window.Tool, el = T.el, svg = T.svg;
  var root = T.root;
  var WEEKS = 13;

  // No example numbers (Legal L82): the runway only ever draws from what the member types.
  var blank = function () { return { start: T.monday(), cash: 0, ins: [], outs: [], once: [] }; };
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = blank(); demo = true; }

  // Does a repeating line land in week i (0-based) of a run starting on Monday `start`?
  function lands(l, i, start) {
    if (l.every === 'week') return true;
    if (l.every === 'two') return i % 2 === 0;
    var a = T.addDays(start, i * 7), b = T.addDays(start, i * 7 + 6);
    return a.slice(8) === '01' || a.slice(0, 7) !== b.slice(0, 7);
  }
  function run(d) {
    var start = d.start || T.monday(), bal = d.cash, rows = [];
    for (var i = 0; i < WEEKS; i += 1) {
      var inn = 0, out = 0;
      d.ins.forEach(function (l) { if (lands(l, i, start)) inn += l.amount; });
      d.outs.forEach(function (l) { if (lands(l, i, start)) out += l.amount; });
      d.once.forEach(function (o) { if (o.week === i + 1) { if (o.amount >= 0) inn += o.amount; else out -= o.amount; } });
      bal += inn - out;
      rows.push({ i: i, start: T.addDays(start, i * 7), inn: inn, out: out, bal: bal });
    }
    var low = rows.reduce(function (m, r) { return r.bal < m.bal ? r : m; }, rows[0]);
    var short = rows.filter(function (r) { return r.bal < 0; })[0] || null;
    return { rows: rows, low: low, short: short, end: rows[rows.length - 1].bal, burn: (rows.reduce(function (s, r) { return s + r.out - r.inn; }, 0)) / WEEKS };
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    nodes = {};
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'How much cash does the business have today?' }),
      el('p', { class: 'tl-start-s', text: 'Then add what comes in and goes out. Thirteen weeks draw as you type.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Start with my numbers', onclick: function () { data = blank(); draw(); var f = root.querySelector('input'); if (f) f.focus(); } }),
      ]),
    ]));
    var thisWeek = T.monday();
    if (data.start && data.start < T.addDays(thisWeek, -6) && !demo) {
      root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'These 13 weeks started ' + T.day(data.start) + '.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start from this week', onclick: function () { data.start = thisWeek; changed(true); draw(); } })]));
    }
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.chart = el('section', { class: 'tl-panel ch-chart' });
    nodes.table = el('div', { class: 'ch-table' });
    T.reveal(nodes.chart, 'chart');
    root.appendChild(nodes.sum);
    root.appendChild(nodes.chart);
    root.appendChild(el('div', { class: 'ch-grid' }, [
      el('div', { class: 'ch-in' }, [
        el('section', { class: 'tl-panel' }, [T.field({ label: 'Cash in the business today', pre: '$', big: true, neg: true, value: data.cash || '', onInput: function (v) { data.cash = v; changed(); } }), el('p', { class: 'tl-note', text: 'Bank balance today, the week of ' + T.day(data.start || thisWeek) + '.' })]),
        lines('Money in that repeats', 'ins', 'Client retainer'),
        lines('Money out that repeats', 'outs', 'Rent'),
        onceList(),
      ]),
      nodes.tablePanel = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'Week by week' }), nodes.table]),
    ]));
    root.appendChild(T.estimate());
    update();
  }

  var EVERY = [['week', 'Every week'], ['two', 'Every 2 weeks'], ['month', 'Every month']];
  function lines(title, k, eg) {
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: title })]);
    data[k].forEach(function (l, i) {
      var sel = el('select', { class: 'tl-sel', 'aria-label': 'How often' }, EVERY.map(function (e) { return el('option', { value: e[0], selected: l.every === e[0] ? true : null, text: e[1] }); }));
      sel.addEventListener('change', function () { l.every = sel.value; changed(); });
      box.appendChild(el('div', { class: 'ch-line' }, [
        T.text({ value: l.name, placeholder: eg, aria: title + ' ' + (i + 1) + ' name', onInput: function (v) { l.name = v; changed(true); } }),
        T.field({ pre: '$', value: l.amount || '', aria: title + ' ' + (i + 1) + ' amount', onInput: function (v) { l.amount = v; changed(); } }),
        sel,
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove', text: '×', onclick: function () { data[k].splice(i, 1); changed(); draw(); } }),
      ]));
    });
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Add a line', onclick: function () { data[k].push({ name: '', amount: 0, every: 'month' }); draw(); var all = box.parentNode && root.querySelectorAll('[aria-label="' + title + ' ' + data[k].length + ' name"]'); if (all && all[0]) all[0].focus(); } }));
    return box;
  }

  function onceList() {
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'One-offs' }), el('p', { class: 'tl-note', text: 'A tax bill, a big purchase, a launch. Money out is a minus.' })]);
    data.once.forEach(function (o, i) {
      var wk = el('select', { class: 'tl-sel', 'aria-label': 'Which week' }, Array.from({ length: WEEKS }, function (_, n) { return el('option', { value: n + 1, selected: o.week === n + 1 ? true : null, text: 'Week of ' + T.day(T.addDays(data.start || T.monday(), n * 7)) }); }));
      wk.addEventListener('change', function () { o.week = +wk.value; changed(); });
      box.appendChild(el('div', { class: 'ch-line' }, [
        T.text({ value: o.name, placeholder: 'Quarterly tax', aria: 'One-off ' + (i + 1) + ' name', onInput: function (v) { o.name = v; changed(true); } }),
        T.field({ pre: '$', neg: true, value: o.amount || '', aria: 'One-off ' + (i + 1) + ' amount', onInput: function (v) { o.amount = v; changed(); } }),
        wk,
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove', text: '×', onclick: function () { data.once.splice(i, 1); changed(); draw(); } }),
      ]));
    });
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Add a one-off', onclick: function () { data.once.push({ name: '', amount: 0, week: 1 }); draw(); } }));
    return box;
  }

  function update() {
    var r = run(data);
    // Nothing typed yet: no chart or table of zeros, just what to type first.
    var empty = !data.cash && !data.ins.length && !data.outs.length && !data.once.length;
    nodes.chart.hidden = empty;
    nodes.tablePanel.hidden = empty;
    if (empty) {
      nodes.sum.innerHTML = '';
      nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [el('span', { class: 'tl-k', text: 'Tightest week' }), el('b', { class: 'tl-hero-v', text: '–' }), el('span', { class: 'tl-d', text: 'Type your bank balance today, then one thing that comes in and one that goes out. The thirteen weeks draw as you type.' })]));
      return;
    }
    // Summary: the tightest week, where it ends, the average weekly change.
    nodes.sum.innerHTML = '';
    var big = el('b', { class: 'tl-hero-v' });
    big._v = nodes.wasLow;
    nodes.wasLow = r.short ? r.short.bal : r.low.bal;
    T.tween(big, nodes.wasLow, function (v) { return T.money(v, 0); });
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: r.short ? 'Runs short the week of ' + T.day(r.short.start) : 'Tightest week: ' + T.day(r.low.start) }),
      big,
      el('span', { class: 'tl-d' + (r.short ? ' warn' : '') , text: r.short ? 'Move a payment, bring money in earlier or cut a line before then.' : r.low.bal < data.cash * 0.25 && data.cash > 0 ? 'Thin. Worth a look before it comes.' : 'Your lowest balance in the next 13 weeks.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'In 13 weeks' }), el('b', { text: T.money(r.end, 0) }), el('span', { class: 'tl-d ' + (r.end > data.cash ? 'up' : ''), text: (r.end >= data.cash ? 'up ' : 'down ') + T.money(Math.abs(r.end - data.cash), 0) + ' from today' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: r.burn > 0 ? 'Going out a week, on average' : 'Coming in a week, on average' }), el('b', { text: T.money(Math.abs(r.burn), 0) }), el('span', { class: 'tl-d', text: r.burn > 0 && data.cash > 0 ? 'Cash lasts about ' + Math.max(0, Math.floor(data.cash / r.burn)) + ' weeks at this pace' : 'More in than out over 13 weeks' })]));
    drawChart(r);
    // The table.
    nodes.table.innerHTML = '';
    var t = el('table', null, [el('thead', null, [el('tr', null, ['Week of', 'In', 'Out', 'Balance'].map(function (h) { return el('th', { text: h, scope: 'col' }); }))])]);
    var tb = el('tbody');
    r.rows.forEach(function (row) {
      tb.appendChild(el('tr', { class: row === (r.short || r.low) ? 'is-low' : row.bal < 0 ? 'is-neg' : '' }, [
        el('td', { text: T.day(row.start) }), el('td', { text: row.inn ? T.money(row.inn, 0) : '–' }), el('td', { text: row.out ? T.money(row.out, 0) : '–' }), el('td', { text: T.money(row.bal, 0) }),
      ]));
    });
    t.appendChild(tb);
    nodes.table.appendChild(t);
  }

  function drawChart(r) {
    var box = nodes.chart;
    box.innerHTML = '';
    box.appendChild(el('h2', { class: 'tl-h', text: 'The next 13 weeks' }));
    var W = Math.max(300, Math.min(1000, (box.clientWidth || 800) - 40)), H = W < 480 ? 230 : 260, L = 56, R = 16, Tp = 22, B = 30, every = W < 480 ? 3 : 2;
    var vals = r.rows.map(function (x) { return x.bal; }).concat([data.cash, 0]);
    var flows = r.rows.map(function (x) { return Math.max(x.inn, x.out); });
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    var pad = (hi - lo) * 0.12 || 100; hi += pad; lo = Math.min(0, lo - pad);
    var colW = (W - L - R) / WEEKS;
    var X = function (i) { return L + colW * (i + 0.5); }, Y = function (v) { return Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B); };
    var fmax = Math.max.apply(null, flows.concat([1]));
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ch-svg', role: 'img', 'aria-label': 'Balance for the next 13 weeks. Lowest ' + T.money((r.short || r.low).bal, 0) + ' the week of ' + T.day((r.short || r.low).start) });
    [hi - pad, (hi - pad + lo) / 2, lo].forEach(function (v) { s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' })); var t = svg('text', { x: L - 8, y: Y(v) + 4, class: 'lab', 'text-anchor': 'end' }); t.textContent = T.money(Math.round(v / 10) * 10, 0); s.appendChild(t); });
    if (lo < 0) s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: 'zero' }));
    // In and out as thin paired bars along the bottom band.
    var band = 34, base = H - B;
    r.rows.forEach(function (x, i) {
      if (x.inn) s.appendChild(svg('rect', { x: X(i) - 5, y: base - (x.inn / fmax) * band, width: 4, height: (x.inn / fmax) * band, rx: 1, class: 'in' }));
      if (x.out) s.appendChild(svg('rect', { x: X(i) + 1, y: base - (x.out / fmax) * band, width: 4, height: (x.out / fmax) * band, rx: 1, class: 'out' }));
      if (i % every === 0) { var t = svg('text', { x: X(i), y: H - 8, class: 'lab', 'text-anchor': 'middle' }); t.textContent = T.day(x.start); s.appendChild(t); }
    });
    var d = 'M' + L + ' ' + Y(data.cash) + ' ' + r.rows.map(function (x, i) { return 'L' + X(i).toFixed(1) + ' ' + Y(x.bal).toFixed(1); }).join(' ');
    s.appendChild(svg('path', { d: d, class: 'bal', pathLength: 1 }));
    var lit = r.short || r.low;
    r.rows.forEach(function (x, i) { s.appendChild(svg('circle', { cx: X(i), cy: Y(x.bal), r: x === lit ? 5.5 : 2.5, class: x === lit ? 'is-lit' : x.bal < 0 ? 'neg' : 'pt' })); });
    var lx = X(lit.i), ly = Y(lit.bal), right = lx > W * 0.66;
    var lab = svg('text', { x: lx + (right ? 6 : -6), y: ly + (ly > H - B - 60 ? -16 : 24), class: 'lab pop', 'text-anchor': right ? 'end' : 'start' });
    lab.textContent = (r.short ? 'Short: ' : 'Lowest: ') + T.money(lit.bal, 0);
    s.appendChild(lab);
    box.appendChild(s);
    box.appendChild(el('div', { class: 'ch-key' }, [el('span', null, [el('i', { class: 'in' }), 'In']), el('span', null, [el('i', { class: 'out' }), 'Out']), el('span', null, [el('i', { class: 'bal' }), 'Balance'])]));
  }

  function changed(quiet) {
    if (!demo) T.save(data);
    if (!quiet) update();
  }

  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (nodes.chart && data) update(); }, 150); });
  draw();
})();
