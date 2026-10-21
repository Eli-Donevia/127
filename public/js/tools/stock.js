// Stock and reorder (lib/tools 'stock'): each product's stock, weekly sales and reorder lead time. Weeks left =
// on hand / sold a week; reorder by = today + weeks left - lead time. The product to reorder soonest is the one thing
// lit in Tide. Saves { items } as the member types.
(function () {
  'use strict';
  var T = window.Tool, el = T.el;
  var root = T.root;
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var it = function (name, onHand, perWeek, leadWeeks, order, cost) { return { id: uid(), name: name, onHand: onHand, perWeek: perWeek, leadWeeks: leadWeeks, order: order, cost: cost }; };
  // The example has counts only, no costs (Legal L82 spirit: no example money).
  var EXAMPLE = { items: [it('Lavender candle, 8 oz', 46, 9, 2, 60, 0), it('Cedar candle, 8 oz', 18, 7, 2, 60, 0), it('Gift box of three', 31, 3, 3, 24, 0), it('Wax melts, 6 pack', 72, 6, 1, 40, 0)] };
  var data = T.state.data, demo = false;
  if (!T.state.canSave) { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; }

  function read(x) {
    var weeks = x.perWeek > 0 ? x.onHand / x.perWeek : null;
    var slack = weeks == null ? null : weeks - x.leadWeeks;
    return { weeks: weeks, slack: slack, by: slack == null ? null : T.addDays(T.iso(new Date()), Math.floor(slack * 7)), out: weeks == null ? null : T.addDays(T.iso(new Date()), Math.floor(weeks * 7)) };
  }

  var nodes = {};
  function draw() {
    root.innerHTML = '';
    if (!data) return root.appendChild(el('div', { class: 'tl-start' }, [
      el('p', { class: 'tl-start-q', text: 'Never sell out of your best product by surprise.' }),
      el('p', { class: 'tl-start-s', text: 'For each product: how many you have, how many sell a week, and how long a reorder takes to arrive.' }),
      el('div', { class: 'tl-start-b' }, [
        el('button', { type: 'button', class: 'btn', text: 'Add my products', onclick: function () { data = { items: [it('', 0, 0, 2, 0, 0)] }; draw(); var f = root.querySelector('.tl-tx'); if (f) f.focus(); } }),
        el('button', { type: 'button', class: 'tl-act', text: 'See it with example products first', onclick: function () { data = JSON.parse(JSON.stringify(EXAMPLE)); demo = true; draw(); } }),
      ]),
    ]));
    if (demo && T.state.canSave) root.appendChild(el('div', { class: 'tl-demo' }, [el('span', { text: 'Example products. Nothing is saved.' }), el('button', { class: 'tl-act', type: 'button', text: 'Start mine', onclick: function () { data = null; demo = false; draw(); } })]));
    nodes.sum = el('section', { class: 'tl-sum' });
    nodes.list = el('div', { class: 'sk-list' });
    root.appendChild(nodes.sum);
    root.appendChild(nodes.list);
    root.appendChild(T.estimate()); // on weeks left and the reorder dates (Legal L92 HT5)
    root.appendChild(el('button', { type: 'button', class: 'tl-act id-add', text: 'Add a product', onclick: function () { data.items.push(it('', 0, 0, 2, 0, 0)); changed(); draw(); var all = root.querySelectorAll('.sk-name'); all[all.length - 1].focus(); } }));
    rows();
    update();
  }

  function soonest() {
    return data.items.map(function (x) { return { x: x, r: read(x) }; }).filter(function (p) { return p.r.slack != null; }).sort(function (a, b) { return a.r.slack - b.r.slack; })[0] || null;
  }

  function update() {
    var s = soonest(), value = data.items.reduce(function (n, x) { return n + x.onHand * x.cost; }, 0);
    var late = data.items.filter(function (x) { var r = read(x); return r.slack != null && r.slack <= 0; }).length;
    nodes.sum.innerHTML = '';
    nodes.sum.appendChild(el('div', { class: 'tl-hero' }, [
      el('span', { class: 'tl-k', text: s ? 'Reorder next: ' + (s.x.name || 'unnamed product') : 'Reorder next' }),
      el('b', { class: 'tl-hero-v', text: s ? (s.r.slack <= 0 ? 'Now' : T.day(s.r.by)) : '–' }),
      el('span', { class: 'tl-d' + (s && s.r.slack <= 0 ? ' warn' : ''), text: s ? (s.r.slack <= 0 ? 'A reorder takes ' + s.x.leadWeeks + ' weeks and stock runs out ' + T.day(s.r.out) + '. Order today.' : Math.floor(s.r.weeks) + ' weeks of stock, ' + s.x.leadWeeks + ' to restock.') : 'Add how many sell a week.' }),
    ]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Need ordering now' }), el('b', { text: String(late) }), el('span', { class: 'tl-d', text: 'of ' + data.items.length + ' products' })]));
    nodes.sum.appendChild(el('div', { class: 'tl-stat' }, [el('span', { class: 'tl-k', text: 'Stock on the shelf' }), el('b', { text: value > 0 ? T.money(value, 0) : '–' }), el('span', { class: 'tl-d', text: value > 0 ? 'at what you paid' : 'Add what each one costs you' })]));
    var lit = s && s.x.id;
    Array.prototype.forEach.call(nodes.list.children, function (row) {
      var x = data.items.filter(function (i) { return i.id === row.getAttribute('data-id'); })[0];
      if (!x) return;
      var r = read(x), max = 12;
      row.classList.toggle('lead', x.id === lit);
      row.querySelector('.sk-wk').textContent = r.weeks == null ? '–' : (r.weeks >= 52 ? '52+' : r.weeks.toFixed(r.weeks < 10 ? 1 : 0)) + ' wks';
      row.querySelector('.sk-by').textContent = r.slack == null ? 'Add weekly sales' : r.slack <= 0 ? 'Reorder now' : 'Reorder by ' + T.day(r.by);
      var bar = row.querySelector('.sk-bar');
      bar.querySelector('.left').style.width = Math.min(100, ((r.weeks || 0) / max) * 100) + '%';
      bar.querySelector('.lead').style.left = Math.min(100, (x.leadWeeks / max) * 100) + '%';
    });
  }

  function rows() {
    nodes.list.innerHTML = '';
    data.items.forEach(function (x, i) {
      var name = T.text({ value: x.name, max: 60, placeholder: 'Product name', aria: 'Product ' + (i + 1), onInput: function (v) { x.name = v; changed(); } });
      name.classList.add('sk-name');
      var f = function (label, k, o) { return T.field(Object.assign({ label: label, value: x[k] || '', aria: label + ' for product ' + (i + 1), onInput: function (v) { x[k] = v; changed(); } }, o || {})); };
      nodes.list.appendChild(el('article', { class: 'sk-row', 'data-id': x.id }, [
        el('div', { class: 'sk-head' }, [name, el('span', { class: 'sk-wk' }), el('button', { type: 'button', class: 'tl-ic', 'aria-label': 'Remove product ' + (i + 1), text: '×', onclick: function () { data.items.splice(i, 1); changed(); draw(); } })]),
        el('div', { class: 'sk-bar', 'aria-hidden': 'true' }, [el('i', { class: 'left' }), el('i', { class: 'lead' })]),
        el('span', { class: 'sk-by' }),
        el('div', { class: 'sk-fields' }, [f('On hand', 'onHand', { int: true }), f('Sold a week', 'perWeek'), f('Reorder takes', 'leadWeeks', { post: 'wks' }), f('Reorder', 'order', { int: true, post: 'units' }), f('Cost each', 'cost', { pre: '$' })]),
      ]));
    });
  }

  function changed() { if (!demo) T.save(data); update(); }
  draw();
})();
