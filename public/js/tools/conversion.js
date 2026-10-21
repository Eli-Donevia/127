// Conversion tracker (lib/tools 'conversion'): the member's funnel steps and one row of counts a week. Draws the
// funnel with the rate between each step, the step that fell furthest below the member's own usual (the leak, the
// one thing lit in Pop on the page), the week strip and the end-to-end trend. Saves { steps, weeks } as they type.
(function () {
  'use strict';
  var T = window.Tool, el = T.el, svg = T.svg;
  var root = T.root;

  var FUNNELS = [
    { id: 'service', name: 'Service or coaching', steps: ['Messages sent', 'Replies', 'Calls booked', 'Clients'] },
    { id: 'store', name: 'Online store', steps: ['Visitors', 'Added to cart', 'Checkouts', 'Orders'] },
    { id: 'content', name: 'Content to sales', steps: ['Views', 'Profile visits', 'Link clicks', 'Sales'] },
    { id: 'local', name: 'Local jobs', steps: ['Calls and DMs', 'Quotes sent', 'Jobs booked', 'Paid'] },
  ];
  // Where to go when a step leaks, by its place in the funnel: the first gap, the middle ones, the last.
  var FIX = {
    first: ['website.conversion_audit', 'Why is my site not converting?'],
    mid: ['outreach.follow_ups', 'Follow-up sequence'],
    last: ['review.skeptic', 'Red-team it as a skeptical buyer'],
  };

  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  function fresh(f) {
    return { steps: f.steps.map(function (n) { return { id: uid(), name: n }; }), weeks: [{ start: T.monday(), counts: {}, revenue: 0 }] };
  }
  function example() {
    var d = fresh(FUNNELS[0]), ids = d.steps.map(function (s) { return s.id; });
    var rows = [[120, 18, 6, 1, 600], [140, 22, 7, 2, 1200], [150, 24, 8, 2, 1200], [160, 27, 9, 3, 1800], [155, 25, 8, 2, 1200], [170, 29, 5, 2, 1200]];
    d.weeks = rows.map(function (r, i) {
      var c = {}; ids.forEach(function (id, j) { c[id] = r[j]; });
      return { start: T.addDays(T.monday(), -7 * (rows.length - 1 - i)), counts: c, revenue: r[4] };
    }).reverse();
    return d;
  }

  var data = T.state.data, demo = false, pick = null;
  if (!T.state.canSave) { data = example(); demo = true; }

  // ---------- math ----------
  var c = function (w, s) { return (w && w.counts && +w.counts[s.id]) || 0; };
  var rate = function (w, a, b) { var x = c(w, a); return x > 0 ? (c(w, b) / x) * 100 : null; };
  function weekOf(start) { return data.weeks.filter(function (w) { return w.start === start; })[0]; }
  function older(start, n) { return data.weeks.filter(function (w) { return w.start < start; }).slice(0, n); }
  // Each gap's rate this week, its usual (the mean of up to four weeks before) and how far below the usual it is.
  function gaps(w) {
    var out = [];
    for (var i = 0; i < data.steps.length - 1; i += 1) {
      var a = data.steps[i], b = data.steps[i + 1], now = rate(w, a, b);
      var prev = older(w.start, 4).map(function (x) { return rate(x, a, b); }).filter(function (x) { return x != null; });
      var usual = prev.length ? prev.reduce(function (s, x) { return s + x; }, 0) / prev.length : null;
      var hist = older(w.start, 7).reverse().concat([w]).map(function (x) { return rate(x, a, b); });
      out.push({ i: i, a: a, b: b, now: now, usual: usual, drop: now != null && usual ? (usual - now) / usual : null, hist: hist });
    }
    // The leak: furthest below its usual when there's history, otherwise the smallest rate.
    var withHist = out.filter(function (g) { return g.drop != null; });
    var leak = null;
    if (withHist.length) leak = withHist.reduce(function (m, g) { return g.drop > m.drop ? g : m; });
    if (leak && leak.drop <= 0.02) leak = null;
    if (!withHist.length) {
      var known = out.filter(function (g) { return g.now != null; });
      if (known.length) leak = known.reduce(function (m, g) { return g.now < m.now ? g : m; });
    }
    return { list: out, leak: leak, hasHistory: withHist.length > 0 };
  }

  // ---------- drawing ----------
  var sel = null;
  function draw() {
    root.innerHTML = '';
    if (!data && !pick) return root.appendChild(chooser());
    if (!sel || !weekOf(sel)) sel = data.weeks[0].start;
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example numbers. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    var w = weekOf(sel), g = gaps(w);
    root.appendChild(summary(w, g));
    root.appendChild(el('div', { class: 'cv-grid' }, [funnel(w, g), el('div', { class: 'cv-side' }, [weeks(w), trend(w), stepsEditor()])]));
  }

  function chooser() {
    var box = el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Which funnel is closest to yours?' }),
      el('p', { class: 'tl-start-s', text: 'You can rename, add or remove steps after.' }),
    ]);
    var list = el('div', { class: 'cv-pick' });
    FUNNELS.forEach(function (f) {
      list.appendChild(el('button', { type: 'button', class: 'cv-pick-b', onclick: function () { data = fresh(f); sel = null; T.save(data); draw(); } }, [
        el('span', { class: 'cv-pick-n', text: f.name }),
        el('span', { class: 'cv-pick-s' }, f.steps.map(function (s, i) { return el('span', null, [i ? el('i', { 'aria-hidden': 'true' }) : null, s]); })),
      ]));
    });
    box.appendChild(list);
    box.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'See it with example numbers first', onclick: function () { data = example(); demo = true; draw(); } }));
    return box;
  }

  var heroNodes = {};
  function summary(w, g) {
    var first = data.steps[0], last = data.steps[data.steps.length - 1];
    var e2e = c(w, first) ? (c(w, last) / c(w, first)) * 100 : null;
    var prev = older(w.start, 1)[0];
    var e2eWas = prev && c(prev, first) ? (c(prev, last) / c(prev, first)) * 100 : null;
    var big = el('b', { class: 'tl-hero-v' });
    big._v = heroNodes.was;
    heroNodes.was = e2e == null ? 0 : e2e;
    T.tween(big, e2e == null ? 0 : e2e, function (v) { return e2e == null ? '–' : T.pct(v, v < 10 ? 1 : 0); });
    var delta = e2e != null && e2eWas != null ? e2e - e2eWas : null;
    var rev = w.revenue > 0 && c(w, first) ? w.revenue / c(w, first) : null;
    return el('section', { class: 'tl-sum' }, [
      el('div', { class: 'tl-hero' }, [
        el('span', { class: 'tl-k', text: first.name + ' to ' + last.name.toLowerCase() + ', week of ' + T.day(w.start) }),
        big,
        delta == null ? el('span', { class: 'tl-d', text: prev ? 'No count for last week' : 'Your first week. Next week shows the change.' })
          : el('span', { class: 'tl-d ' + (delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : '') }, [(delta > 0 ? '+' : delta < 0 ? '−' : '') + Math.abs(delta).toFixed(1) + ' pts on last week']),
      ]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: last.name + ' this week' }), el('b', { text: T.count(c(w, last)) }), el('span', { class: 'tl-d', text: 'from ' + T.count(c(w, first)) + ' ' + first.name.toLowerCase() })]),
      el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Every 100 ' + first.name.toLowerCase() + ' brought in' }), el('b', { text: rev == null ? '–' : T.money(rev * 100, 0) }), el('span', { class: 'tl-d', text: rev == null ? 'Add this week’s revenue to see it' : T.money(w.revenue) + ' revenue this week' })]),
    ]);
  }

  function funnel(w, g) {
    var max = Math.max.apply(null, data.steps.map(function (s) { return c(w, s); }).concat([1]));
    var box = el('section', { class: 'cv-funnel', 'aria-label': 'Your funnel this week' });
    data.steps.forEach(function (s, i) {
      var v = c(w, s), width = v > 0 ? Math.max(3, (Math.log10(v + 1) / Math.log10(max + 1)) * 100) : 0;
      var bar = el('span', { class: 'cv-bar' }, [el('i', { style: '--w:' + width.toFixed(1) + '%' })]);
      box.appendChild(el('div', { class: 'cv-row' + (g.leak && g.leak.i + 1 === i ? ' after-leak' : '') }, [
        el('span', { class: 'cv-i', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'cv-name', text: s.name }),
        T.field({ value: v || '', aria: s.name + ' this week', int: true, cls: 'cv-n', disabled: false, onInput: function (x) { w.counts[s.id] = x; changed(); } }),
        bar,
      ]));
      if (i < data.steps.length - 1) box.appendChild(gap(g.list[i], g.leak, g.hasHistory));
    });
    T.reveal(box, 'funnel');
    return box;
  }

  function spark(hist, lit) {
    var pts = hist.map(function (v, i) { return [i, v]; }).filter(function (p) { return p[1] != null; });
    if (pts.length < 2) return null;
    var W = 88, H = 26, n = hist.length - 1 || 1, hi = Math.max.apply(null, pts.map(function (p) { return p[1]; })) || 1;
    var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + ((p[0] / n) * W).toFixed(1) + ' ' + (H - 3 - (p[1] / hi) * (H - 6)).toFixed(1); }).join(' ');
    var lastP = pts[pts.length - 1];
    return svg('svg', { class: 'cv-spark' + (lit ? ' is-lit' : ''), viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' }, [
      svg('path', { d: d, pathLength: 1 }),
      svg('circle', { cx: ((lastP[0] / n) * W).toFixed(1), cy: (H - 3 - (lastP[1] / hi) * (H - 6)).toFixed(1), r: 2.4 }),
    ]);
  }

  function gap(x, leak, hasHistory) {
    var isLeak = leak && leak.i === x.i, last = data.steps.length - 2;
    var words = x.now == null ? 'Add ' + x.a.name.toLowerCase() + ' to see the rate'
      : x.usual == null ? 'moved on to ' + x.b.name.toLowerCase()
      : Math.abs(x.now - x.usual) < 0.05 ? 'same as your usual'
      : Math.abs(x.now - x.usual).toFixed(1) + ' pts ' + (x.now > x.usual ? 'above' : 'below') + ' your usual ' + T.pct(x.usual);
    var kids = [
      el('span', { class: 'cv-gap-r', text: x.now == null ? '–' : T.pct(x.now) }),
      el('span', { class: 'cv-gap-w ' + (x.usual != null && x.now != null ? (x.now > x.usual + 0.05 ? 'up' : x.now < x.usual - 0.05 ? 'down' : '') : '') , text: words }),
      spark(x.hist, isLeak),
    ];
    if (isLeak) {
      var fix = x.i === 0 ? FIX.first : x.i === last ? FIX.last : FIX.mid;
      kids.push(el('span', { class: 'cv-leak' }, [
        el('b', { text: hasHistory ? 'Your leak this week' : 'Your biggest drop' }),
        el('span', { text: hasHistory ? 'This step fell furthest below your usual. Fix it before you add more ' + data.steps[0].name.toLowerCase() + '.' : 'The fewest people get past this step. Start here.' }),
        T.state.prompts ? el('a', { class: 'link', href: '/app/hq/prompts/' + fix[0], text: 'Open the prompt: ' + fix[1] }) : null,
      ]));
    }
    return el('div', { class: 'cv-gap' + (isLeak ? ' leak' : '') }, kids);
  }

  function weeks(w) {
    var strip = el('div', { class: 'cv-weeks', role: 'tablist', 'aria-label': 'Weeks' });
    data.weeks.slice(0, 10).forEach(function (x) {
      strip.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': x.start === sel ? 'true' : 'false', class: 'cv-wk' + (x.start === sel ? ' on' : ''), text: T.day(x.start), onclick: function () { sel = x.start; draw(); } }));
    });
    var next = T.addDays(data.weeks[0].start, 7);
    var canAdd = next <= T.addDays(T.monday(), 0);
    var add = el('button', { type: 'button', class: 'tl-act', text: canAdd ? 'Log week of ' + T.day(next) : 'This week is the newest', disabled: canAdd ? null : true, onclick: function () {
      data.weeks.unshift({ start: next, counts: {}, revenue: 0 }); sel = next; changed(true);
    } });
    return el('section', { class: 'tl-panel' }, [
      el('h2', { class: 'tl-h', text: 'Weeks' }),
      strip,
      T.field({ label: 'Revenue the week of ' + T.day(w.start), pre: '$', value: w.revenue || '', hint: 'Optional. Turns rates into money.', onInput: function (x) { w.revenue = x; changed(); } }),
      add,
    ]);
  }

  function trend(w) {
    var first = data.steps[0], last = data.steps[data.steps.length - 1];
    var pts = data.weeks.slice(0, 12).reverse().map(function (x) { return { start: x.start, v: c(x, first) ? (c(x, last) / c(x, first)) * 100 : null }; });
    var known = pts.filter(function (p) { return p.v != null; });
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'End to end, by week' })]);
    if (known.length < 2) { box.appendChild(el('p', { class: 'tl-note', text: 'Log a second week and the trend draws here.' })); return box; }
    var W = 320, H = 120, P = 8, hi = Math.max.apply(null, known.map(function (p) { return p.v; })) * 1.15 || 1, n = pts.length - 1 || 1;
    var X = function (i) { return P + (i / n) * (W - 2 * P); }, Y = function (v) { return H - P - (v / hi) * (H - 2 * P - 10); };
    var d = '', area = '';
    pts.forEach(function (p, i) { if (p.v == null) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1) + ' '; });
    var on = pts.map(function (p) { return p.start; }).indexOf(w.start);
    var s = svg('svg', { class: 'cv-trend', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'End-to-end rate for the last ' + pts.length + ' weeks' }, [
      svg('line', { x1: P, x2: W - P, y1: H - P, y2: H - P, class: 'ax' }),
      svg('path', { d: d, class: 'ln', pathLength: 1 }),
    ]);
    pts.forEach(function (p, i) { if (p.v != null) s.appendChild(svg('circle', { cx: X(i), cy: Y(p.v), r: i === on ? 4.5 : 2.5, class: i === on ? 'on' : 'pt' })); });
    box.appendChild(s);
    box.appendChild(el('div', { class: 'cv-trend-x' }, [el('span', { text: T.day(pts[0].start) }), el('span', { text: T.day(pts[pts.length - 1].start) })]));
    T.reveal(box, 'trend');
    return box;
  }

  function stepsEditor() {
    var d = el('details', { class: 'tl-panel cv-steps' }, [el('summary', { class: 'tl-h', text: 'Change the steps' })]);
    data.steps.forEach(function (s, i) {
      d.appendChild(el('div', { class: 'cv-step' }, [
        el('span', { class: 'cv-i', text: String(i + 1).padStart(2, '0') }),
        T.text({ value: s.name, max: 40, aria: 'Step ' + (i + 1) + ' name', onInput: function (v) { s.name = v.trim() || s.name; changed(false, true); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Move up', disabled: i ? null : true, text: '↑', onclick: function () { var t = data.steps[i - 1]; data.steps[i - 1] = s; data.steps[i] = t; changed(true); } }),
        el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove ' + s.name, disabled: data.steps.length > 2 ? null : true, text: '×', onclick: function () { data.steps.splice(i, 1); changed(true); } }),
      ]));
    });
    if (data.steps.length < 7) d.appendChild(el('button', { type: 'button', class: 'tl-act', text: 'Add a step', onclick: function () { data.steps.push({ id: uid(), name: 'New step' }); changed(true); d.open = true; } }));
    d.open = !!stepsOpen;
    d.addEventListener('toggle', function () { stepsOpen = d.open; });
    return d;
  }
  var stepsOpen = false;

  // A count changed: redraw everything but keep the focused field (and its caret) where it was.
  function changed(full, quiet) {
    if (!demo) T.save(data);
    if (quiet) return;
    var a = document.activeElement, label = a && a.getAttribute && a.getAttribute('aria-label'), pos = a && a.selectionStart;
    draw();
    if (!full && label) {
      var back = root.querySelector('[aria-label="' + label.replace(/"/g, '\\"') + '"]');
      if (back) { T.keepCaret = true; back.focus(); try { back.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } }
    }
  }

  draw();
})();
