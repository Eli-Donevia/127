// Ad test planner (lib/tools 'adtest'): a capped test, the line (the most to pay for one result, by default what a
// customer is worth in the member's Profit tool), and a row a day. The verdict follows the stop rule written before
// the first dollar: stop at twice the line with nothing back, or once three lines are spent above the line; keep
// going while under it. The point where the rule fires (or today's point) is the one thing lit in Pop.
(function () {
  'use strict';
  var T = window.Tool, el = T.el, svg = T.svg;
  var root = T.root;
  var PLATFORMS = [['meta', 'Meta ads'], ['tiktok', 'TikTok'], ['google', 'Google search'], ['youtube', 'YouTube'], ['other', 'Somewhere else']];

  function profitLine() {
    var p = T.state.linked && T.state.linked.profit;
    if (!p || !(p.price > 0)) return null;
    var keep = p.price - p.unitCost - (p.price * p.feePct) / 100 - p.feeFlat;
    return keep > 0 ? Math.round(keep * Math.max(1, p.repeats)) : null;
  }
  // No example numbers (Legal L82 spirit): spend and results only ever come from what the member logs.
  function blank() { return { name: '', platform: 'meta', goal: 'sales', budget: 0, days: 7, line: 0, log: [] }; }
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = blank(); demo = true; }

  var lineOf = function () { return data.line > 0 ? data.line : profitLine() || 0; };
  function verdict() {
    var L = lineOf(), spent = 0, got = 0, clicks = 0, fired = null, pts = [];
    data.log.forEach(function (r, i) {
      spent += r.spend; got += r.results; clicks += r.clicks;
      pts.push({ i: i, day: r.day, spent: spent, got: got });
      if (fired || !L) return;
      if (got === 0 && spent >= 2 * L) fired = { i: i, why: 'Spent twice your line with nothing back.' };
      else if (spent >= 3 * L && got > 0 && spent / got > L) fired = { i: i, why: 'Three lines spent and each result still costs more than your line.' };
    });
    var cpr = got ? spent / got : null;
    var state = !L ? 'noline' : fired ? 'stop' : data.budget && spent >= data.budget ? 'done' : cpr != null && cpr <= L * 0.7 && got >= 3 ? 'scale' : 'run';
    return { L: L, spent: spent, got: got, clicks: clicks, cpr: cpr, fired: fired, state: state, pts: pts, ctr: null };
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    nodes = {};
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Write the stop rule before you spend a dollar.' }),
      el('p', { class: 'tl-start-s', text: profitLine() ? 'Your Profit tool says a customer is worth ' + T.money(profitLine()) + '. That becomes your line unless you set one.' : 'Set the most you can pay for one result. Fill in Profit and break-even and this reads it for you.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Plan my test', onclick: function () { data = blank(); draw(); } }),
      ]),
    ]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.chart = el('section', { class: 'tl-panel ad-chart' });
    T.reveal(nodes.chart, 'chart');
    nodes.log = el('section', { class: 'tl-panel' });
    root.appendChild(nodes.sum);
    root.appendChild(el('div', { class: 'pf-grid' }, [plan(), el('div', { class: 'pf-out' }, [nodes.chart, nodes.log])]));
    update(true);
  }

  function plan() {
    var sel = el('select', { class: 'tl-sel', 'aria-label': 'Where it runs' }, PLATFORMS.map(function (p) { return el('option', { value: p[0], selected: data.platform === p[0] ? true : null, text: p[1] }); }));
    sel.addEventListener('change', function () { data.platform = sel.value; changed(); });
    var goal = el('select', { class: 'tl-sel', 'aria-label': 'What counts as a result' }, [['sales', 'A sale'], ['leads', 'A lead or booking']].map(function (g) { return el('option', { value: g[0], selected: data.goal === g[0] ? true : null, text: g[1] }); }));
    goal.addEventListener('change', function () { data.goal = goal.value; changed(); });
    var pl = profitLine();
    return el('div', { class: 'pf-in tl-panel' }, [
      el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'What you are testing' }), T.text({ value: data.name, max: 60, placeholder: 'Audience, offer or ad', onInput: function (v) { data.name = v; changed(true); } })]),
      el('div', { class: 'pf-two ad-two' }, [el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'Where it runs' }), sel]), el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'A result is' }), goal])]),
      el('fieldset', { class: 'pf-g' }, [el('legend', { class: 'tl-h', text: 'The cap' }),
        T.field({ label: 'Total you will spend, at most', pre: '$', big: true, value: data.budget || '', onInput: function (v) { data.budget = v; changed(); } }),
        T.field({ label: 'Over how many days', post: 'days', int: true, value: data.days, onInput: function (v) { data.days = Math.max(1, Math.round(v)); changed(); } }),
      ]),
      el('fieldset', { class: 'pf-g' }, [el('legend', { class: 'tl-h', text: 'The line' }),
        T.field({ label: 'Most to pay for one result', pre: '$', value: data.line || '', placeholder: pl ? String(pl) : '0', hint: pl ? 'Blank uses ' + T.money(pl) + ', what a customer is worth in your Profit tool.' : 'Fill in Profit and break-even to get this from your own numbers.', onInput: function (v) { data.line = v; changed(); } }),
        el('p', { class: 'tl-note ad-rule', text: 'Stop rule: stop at twice the line with nothing back, or once three lines are spent and each result still costs more than the line.' }),
      ]),
    ]);
  }

  function update(full) {
    var v = verdict();
    nodes.sum.innerHTML = '';
    var words = { noline: ['Set your line', 'Without a line there is no stop rule. Set the most you can pay for one result.'], stop: ['Stop this test', v.fired && v.fired.why + ' Change the ad, the audience or the offer, then start a new test.'], done: ['Cap reached', 'The test spent what you set. Read the numbers before you add more.'], scale: ['It is working', 'Results cost well under your line. Raise the cap in small steps and keep logging.'], run: ['Keep going', 'Under the stop rule so far. Log every day.'] }[v.state];
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [el('span', { class: 'tl-k', text: (data.name || 'This test') + ', ' + data.log.length + ' day' + (data.log.length === 1 ? '' : 's') + ' in' }), el('b', { class: 'tl-hero-v ad-v' + (v.state === 'scale' ? ' up' : ''), text: words[0] }), el('span', { class: 'tl-d', text: words[1] })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Spent' }), el('b', { text: T.money(v.spent, 0) }), el('span', { class: 'tl-d', text: data.budget ? 'of a ' + T.money(data.budget, 0) + ' cap' : 'Set a cap' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Cost per ' + (data.goal === 'leads' ? 'lead' : 'sale') }), el('b', { text: v.cpr == null ? '–' : T.money(v.cpr, 0) }), el('span', { class: 'tl-d' + (v.cpr != null && v.L && v.cpr <= v.L ? ' up' : ''), text: v.L ? (v.got ? v.got + ' so far, line ' + T.money(v.L, 0) : 'Nothing back yet, line ' + T.money(v.L, 0)) : 'No line set' })]));
    drawChart(v);
    if (full) drawLog();
  }

  function drawChart(v) {
    var box = nodes.chart;
    box.innerHTML = '';
    box.appendChild(el('h2', { class: 'tl-h', text: 'Spend against what results are worth' }));
    if (!v.pts.length || !v.L) { box.appendChild(el('p', { class: 'tl-note', text: v.L ? 'Log your first day and it draws here.' : 'Set your line to draw the stop rule.' })); return; }
    var W = Math.max(300, Math.min(760, (box.clientWidth || 600) - 40)), H = 220, Lp = 48, R = 12, Tp = 16, B = 28, n = Math.max(data.days, v.pts.length) - 1 || 1;
    var cap = Math.max(data.budget || 0, v.spent, 3 * v.L, v.got * v.L) * 1.08;
    var X = function (i) { return Lp + (i / n) * (W - Lp - R); }, Y = function (x) { return Tp + (1 - x / cap) * (H - Tp - B); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'pf-svg', role: 'img', 'aria-label': 'Spend ' + T.money(v.spent, 0) + ' against results worth ' + T.money(v.got * v.L, 0) });
    [0, 0.5, 1].forEach(function (k) { var y = cap / 1.08 * k; s.appendChild(svg('line', { x1: Lp, x2: W - R, y1: Y(y), y2: Y(y), class: 'grid' })); var t = svg('text', { x: Lp - 8, y: Y(y) + 4, class: 'lab', 'text-anchor': 'end' }); t.textContent = T.money(y, 0); s.appendChild(t); });
    if (data.budget) { s.appendChild(svg('line', { x1: Lp, x2: W - R, y1: Y(data.budget), y2: Y(data.budget), class: 'now' })); var tc = svg('text', { x: W - R, y: Y(data.budget) - 6, class: 'lab', 'text-anchor': 'end' }); tc.textContent = 'Cap'; s.appendChild(tc); }
    s.appendChild(svg('path', { d: v.pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p.i) + ' ' + Y(p.got * v.L); }).join(' '), class: 'cost', pathLength: 1 }));
    s.appendChild(svg('path', { d: v.pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p.i) + ' ' + Y(p.spent); }).join(' '), class: 'rev', pathLength: 1 }));
    var lit = v.fired ? v.pts[v.fired.i] : v.pts[v.pts.length - 1];
    s.appendChild(svg('circle', { cx: X(lit.i), cy: Y(lit.spent), r: 5, class: 'be' }));
    var right = X(lit.i) > W * 0.6, tb = svg('text', { x: X(lit.i) + (right ? -10 : 10), y: Y(lit.spent) - 10, class: 'lab pop', 'text-anchor': right ? 'end' : 'start' });
    tb.textContent = v.fired ? 'Stop rule: ' + T.day(lit.day) : 'Today: ' + T.money(lit.spent, 0) + ' spent';
    s.appendChild(tb);
    box.appendChild(s);
    box.appendChild(el('div', { class: 'ch-key' }, [el('span', null, [el('i', { class: 'bal' }), 'Spent']), el('span', null, [el('i', { class: 'out' }), 'Results × your line'])]));
  }

  function drawLog() {
    var box = nodes.log;
    box.innerHTML = '';
    box.appendChild(el('h2', { class: 'tl-h', text: 'Day by day' }));
    data.log.forEach(function (r, i) {
      box.appendChild(el('div', { class: 'ad-row' }, [
        el('span', { class: 'ad-day', text: T.day(r.day) }),
        T.field({ label: 'Spend', pre: '$', value: r.spend || '', aria: 'Spend ' + r.day, onInput: function (x) { r.spend = x; changed(); } }),
        T.field({ label: 'Clicks', int: true, value: r.clicks || '', aria: 'Clicks ' + r.day, onInput: function (x) { r.clicks = x; changed(); } }),
        T.field({ label: data.goal === 'leads' ? 'Leads' : 'Sales', int: true, value: r.results || '', aria: 'Results ' + r.day, onInput: function (x) { r.results = x; changed(); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove ' + T.day(r.day), text: '×', onclick: function () { data.log.splice(i, 1); changed(); update(true); } }),
      ]));
    });
    var next = data.log.length ? T.addDays(data.log[data.log.length - 1].day, 1) : T.iso(new Date());
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Log ' + T.day(next), onclick: function () { data.log.push({ day: next, spend: 0, clicks: 0, results: 0 }); changed(); update(true); var f = box.querySelector('[aria-label="Spend ' + next + '"]'); if (f) f.focus(); } }));
  }

  function changed(quiet) {
    if (!demo) T.save(data);
    if (!quiet) update(false);
  }

  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (nodes.chart && data) update(false); }, 150); });
  draw();
})();
