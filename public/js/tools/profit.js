// Profit and break-even (lib/tools 'profit'): one offer's price and costs in; what a sale leaves, the sales that
// cover the month, the real hourly rate and what a customer is worth out. The break-even point on the chart is the
// one thing lit in Pop. "Try a price" moves every number without saving until the member keeps it.
(function () {
  'use strict';
  var T = window.Tool, el = T.el, svg = T.svg;
  var root = T.root;

  // Every field starts empty and there are no example numbers (Legal L82): results only ever come from what the member types.
  var BLANK = { name: '', price: 0, unitCost: 0, feePct: 0, feeFlat: 0, hours: 0, fixed: 0, cac: 0, repeats: 1, salesNow: 0 };
  var data = T.state.data, demo = false, tryPrice = null;
  if (!T.state.canSave) { data = Object.assign({}, BLANK); demo = true; }

  function calc(d, price) {
    var p = price != null ? price : d.price;
    var fees = (p * d.feePct) / 100 + (p > 0 ? d.feeFlat : 0);
    var keep = p - d.unitCost - fees;
    return {
      price: p, fees: fees, keep: keep, margin: p > 0 ? keep / p : 0,
      be: keep > 0 ? Math.ceil(d.fixed / keep) : null,
      hourly: d.hours > 0 ? keep / d.hours : null,
      worth: keep * Math.max(1, d.repeats),
      payback: keep > 0 && d.cac > 0 ? d.cac / keep : null,
      month: d.salesNow > 0 ? d.salesNow * keep - d.fixed : null,
    };
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    nodes = {};
    if (!data) return root.appendChild(start());
    root.appendChild(el('div', { class: 'pf-grid' }, [inputs(), el('div', { class: 'pf-out' }, [hero(), tiles(), chart(), tryIt(), T.estimate()])]));
    update();
  }

  function start() {
    return el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'What do you sell, and for how much?' }),
      el('p', { class: 'tl-start-s', text: 'Use one offer. Make another copy of the numbers later by exporting.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Start with my numbers', onclick: function () { data = Object.assign({}, BLANK); draw(); var f = root.querySelector('input'); if (f) f.focus(); } }),
      ]),
    ]);
  }

  function set(k) { return function (v) { data[k] = v; changed(); }; }
  function group(title, kids) { return el('fieldset', { class: 'pf-g' }, [el('legend', { class: 'tl-h', text: title })].concat(kids)); }
  function inputs() {
    return el('div', { class: 'pf-in tl-panel' }, [
      el('label', { class: 'tl-f' }, [el('span', { class: 'tl-f-l', text: 'The offer' }), T.text({ value: data.name, max: 60, placeholder: 'What you sell', onInput: function (v) { data.name = v; changed(true); } })]),
      group('One sale', [
        T.field({ label: 'Price', pre: '$', value: data.price || '', big: true, onInput: set('price') }),
        T.field({ label: 'Cost to deliver one', pre: '$', value: data.unitCost || '', hint: 'Materials, shipping, software per sale', onInput: set('unitCost') }),
        el('div', { class: 'pf-two' }, [
          T.field({ label: 'Payment fee', post: '%', value: data.feePct || '', onInput: set('feePct') }),
          T.field({ label: 'Plus per sale', pre: '$', value: data.feeFlat || '', onInput: set('feeFlat') }),
        ]),
        T.field({ label: 'Your hours for one sale', post: 'hrs', value: data.hours || '', hint: 'Delivery, calls, travel, admin', onInput: set('hours') }),
      ]),
      group('Your month', [
        T.field({ label: 'Costs every month', pre: '$', value: data.fixed || '', hint: 'Tools, rent, phone, anything you pay with no sales', onInput: set('fixed') }),
        T.field({ label: 'Sales in a normal month now', value: data.salesNow || '', int: true, hint: 'Optional', onInput: set('salesNow') }),
      ]),
      group('One customer', [
        T.field({ label: 'Marketing cost to get one', pre: '$', value: data.cac || '', hint: 'Ads or giveaways divided by new customers. Optional.', onInput: set('cac') }),
        T.field({ label: 'Times a customer buys', post: '×', value: data.repeats || 1, int: true, onInput: set('repeats') }),
      ]),
    ]);
  }

  function hero() {
    nodes.keep = el('b', { class: 'tl-hero-v' });
    nodes.of = el('span', { class: 'tl-k' });
    nodes.split = el('div', { class: 'pf-split', role: 'img' });
    nodes.legend = el('div', { class: 'pf-leg' });
    return el('section', { class: 'tl-sum pf-hero' }, [el('div', { class: 'tl-hero' }, [nodes.of, nodes.keep, nodes.split, nodes.legend])]);
  }

  function tile(k, label) {
    nodes[k] = el('b');
    nodes[k + 'S'] = el('span', { class: 'tl-d' });
    return el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: label }), nodes[k], nodes[k + 'S']]);
  }
  function tiles() {
    return el('section', { class: 'pf-tiles' }, [tile('be', 'Sales to cover your month'), tile('hr', 'What you make an hour'), tile('worth', 'A customer is worth'), tile('max', 'Most to pay to get one')]);
  }

  function chart() {
    nodes.chart = el('div', { class: 'pf-chart' });
    var box = el('section', { class: 'tl-panel' }, [el('h2', { class: 'tl-h', text: 'Where you break even' }), nodes.chart]);
    T.reveal(box, 'chart');
    return box;
  }

  function tryIt() {
    var r = el('input', { type: 'range', class: 'pf-range', min: 0.5, max: 2, step: 0.01, value: 1, 'aria-label': 'Try a different price' });
    nodes.tryV = el('b');
    nodes.tryS = el('span', { class: 'tl-d' });
    var keep = el('button', { type: 'button', class: 'tl-act', text: 'Use this price', hidden: true });
    r.addEventListener('input', function () {
      var k = +r.value;
      tryPrice = Math.abs(k - 1) < 0.015 ? null : Math.round(data.price * k);
      keep.hidden = tryPrice == null;
      update();
    });
    keep.addEventListener('click', function () { data.price = tryPrice; tryPrice = null; changed(); draw(); });
    return nodes.tryBox = el('section', { class: 'tl-panel pf-try' }, [el('h2', { class: 'tl-h', text: 'Try a price' }), r, el('div', { class: 'pf-try-o' }, [nodes.tryV, nodes.tryS]), keep]);
  }

  function update() {
    var now = calc(data), r = calc(data, tryPrice), p = r.price;
    nodes.of.textContent = p > 0 ? (data.name ? data.name + ': w' : 'W') + 'hat you keep from a ' + T.money(p) + ' sale' : 'What one sale leaves you';
    if (p > 0) T.tween(nodes.keep, r.keep, function (v) { return T.money(v, Math.abs(v) < 100 ? 2 : 0); }); else nodes.keep.textContent = '–';
    nodes.tryBox.hidden = !(data.price > 0);
    // The split bar: cost, fees, and what's left.
    nodes.split.innerHTML = '';
    var parts = p > 0 ? [['cost', data.unitCost], ['fees', r.fees], ['keep', Math.max(0, r.keep)]] : [];
    var total = parts.reduce(function (s, x) { return s + x[1]; }, 0) || 1;
    parts.forEach(function (x) { nodes.split.appendChild(el('i', { class: x[0], style: 'flex-grow:' + Math.max(0.0001, x[1] / total) })); });
    nodes.split.setAttribute('aria-label', 'Of ' + T.money(p) + ': ' + T.money(data.unitCost) + ' to deliver, ' + T.money(r.fees, 2) + ' in fees, ' + T.money(r.keep, 2) + ' kept');
    nodes.legend.innerHTML = '';
    [['cost', 'To deliver', data.unitCost], ['fees', 'Fees', r.fees], ['keep', 'Yours', r.keep]].forEach(function (x) {
      nodes.legend.appendChild(el('span', null, [el('i', { class: x[0] }), x[1] + ' ', el('b', { text: T.money(x[2], x[2] < 100 ? 2 : 0) })]));
    });
    if (r.keep <= 0 && p > 0) nodes.legend.appendChild(el('p', { class: 'pf-warn', text: 'Each sale costs more than it brings in. Raise the price or cut the cost to deliver it.' }));

    nodes.be.textContent = r.be == null ? '–' : T.count(r.be) + (r.be === 1 ? ' sale' : ' sales');
    nodes.beS.textContent = r.be == null ? (r.keep > 0 ? 'Add your monthly costs' : 'Needs a profit per sale') : data.salesNow ? 'You make about ' + T.count(data.salesNow) + ' now' : 'a month, to pay ' + T.money(data.fixed);
    nodes.hr.textContent = r.hourly == null ? '–' : T.money(r.hourly, 2);
    nodes.hrS.textContent = r.hourly == null ? 'Add your hours for one sale' : 'per hour, before your monthly costs';
    nodes.worth.textContent = r.worth > 0 ? T.money(r.worth) : '–';
    nodes.worthS.textContent = data.repeats > 1 ? 'kept over ' + data.repeats + ' purchases' : 'from one purchase';
    nodes.max.textContent = r.worth > 0 ? T.money(r.worth) : '–';
    nodes.maxS.textContent = data.cac > 0 ? (data.cac <= r.worth ? 'You pay ' + T.money(data.cac) + ', earned back in ' + (r.payback <= 1 ? 'the first sale' : Math.ceil(r.payback) + ' sales') : 'You pay ' + T.money(data.cac) + ': each new customer loses money') : 'Pay more than this and a new customer loses money';

    if (tryPrice != null) {
      nodes.tryV.textContent = 'At ' + T.money(tryPrice);
      nodes.tryS.textContent = 'you keep ' + T.money(r.keep, 2) + ' a sale' + (r.be != null ? ', break even at ' + r.be + ' a month' : '') + (now.be != null && r.be != null && r.be !== now.be ? ' (' + (r.be < now.be ? now.be - r.be + ' fewer' : r.be - now.be + ' more') + ')' : '');
    } else {
      nodes.tryV.textContent = 'At ' + T.money(data.price);
      nodes.tryS.textContent = 'Drag to try another price. Every number above moves, and nothing changes until you keep it.';
    }
    drawChart(r);
  }

  function drawChart(r) {
    var box = nodes.chart;
    box.innerHTML = '';
    if (!(r.price > 0)) { box.appendChild(el('p', { class: 'tl-note', text: 'Add a price to draw it.' })); return; }
    var unit = data.unitCost + r.fees;
    var xMax = Math.max(10, Math.ceil(Math.max(r.be ? r.be * 2 : 0, data.salesNow * 1.4)));
    var W = Math.max(300, Math.min(760, box.clientWidth || 560)), H = W < 480 ? 220 : 240, L = 48, R = 12, Tp = 16, B = 28;
    var yMax = Math.max(r.price * xMax, data.fixed + unit * xMax) * 1.05 || 1;
    var X = function (s) { return L + (s / xMax) * (W - L - R); }, Y = function (v) { return Tp + (1 - v / yMax) * (H - Tp - B); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'pf-svg', role: 'img', 'aria-label': r.be ? 'Revenue passes your costs at ' + r.be + ' sales a month' : 'Revenue never passes your costs at this price' });
    [0, 0.5, 1].forEach(function (k) { var v = yMax * k; s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' })); var t = svg('text', { x: L - 8, y: Y(v) + 4, class: 'lab', 'text-anchor': 'end' }); t.textContent = T.money(v >= 1000 ? Math.round(v / 100) * 100 : v, 0); s.appendChild(t); });
    var tx = svg('text', { x: W - R, y: H - 6, class: 'lab', 'text-anchor': 'end' }); tx.textContent = xMax + ' sales a month'; s.appendChild(tx);
    var t0 = svg('text', { x: L, y: H - 6, class: 'lab' }); t0.textContent = '0'; s.appendChild(t0);
    if (r.be != null && r.be <= xMax) {
      s.appendChild(svg('path', { d: 'M' + X(r.be) + ' ' + Y(r.price * r.be) + ' L' + X(xMax) + ' ' + Y(r.price * xMax) + ' L' + X(xMax) + ' ' + Y(data.fixed + unit * xMax) + ' Z', class: 'gain' }));
    }
    s.appendChild(svg('path', { d: 'M' + X(0) + ' ' + Y(data.fixed) + ' L' + X(xMax) + ' ' + Y(data.fixed + unit * xMax), class: 'cost', pathLength: 1 }));
    s.appendChild(svg('path', { d: 'M' + X(0) + ' ' + Y(0) + ' L' + X(xMax) + ' ' + Y(r.price * xMax), class: 'rev', pathLength: 1 }));
    var tc = svg('text', { x: W - R, y: Y(data.fixed + unit * xMax) + (data.fixed + unit * xMax > r.price * xMax ? -8 : 16), class: 'lab', 'text-anchor': 'end' }); tc.textContent = 'Costs'; s.appendChild(tc);
    var tr = svg('text', { x: W - R, y: Y(r.price * xMax) + (r.price * xMax >= data.fixed + unit * xMax ? -8 : 16), class: 'lab ink', 'text-anchor': 'end' }); tr.textContent = 'Revenue'; s.appendChild(tr);
    if (data.salesNow > 0 && data.salesNow <= xMax) {
      s.appendChild(svg('line', { x1: X(data.salesNow), x2: X(data.salesNow), y1: Tp, y2: H - B, class: 'now' }));
      var tn = svg('text', { x: X(data.salesNow) + 6, y: Tp + 10, class: 'lab' }); tn.textContent = 'You now'; s.appendChild(tn);
    }
    if (r.be != null && r.be <= xMax) {
      var bx = X(r.be), by = Y(r.price * r.be);
      s.appendChild(svg('line', { x1: bx, x2: bx, y1: by, y2: H - B, class: 'be-drop' }));
      s.appendChild(svg('circle', { cx: bx, cy: by, r: 5, class: 'be' }));
      var tb = svg('text', { x: bx + (bx > W * 0.7 ? -10 : 10), y: by - 10, class: 'lab pop', 'text-anchor': bx > W * 0.7 ? 'end' : 'start' }); tb.textContent = 'Break even: ' + r.be + ' sales'; s.appendChild(tb);
    }
    box.appendChild(s);
  }

  function changed(quiet) {
    if (!demo) T.save(data);
    if (!quiet) update();
  }

  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (nodes.chart) update(); }, 150); });
  draw();
})();
