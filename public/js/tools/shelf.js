// The Tools shelf (views/app/hq2/tools.ejs): each card's small drawing, and once the member has used a tool, their
// own headline number from it in place of "Open". Works from the saved document printed into the card.
(function () {
  'use strict';
  var T = window.Tool, svg = T.svg;
  var ART = {
    conversion: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      [[0, 100], [1, 64], [2, 38], [3, 20]].forEach(function (r) { s.appendChild(svg('rect', { x: 10, y: 6 + r[0] * 14, width: r[1], height: 8, rx: 4, class: r[0] === 2 ? 'is-lit' : '' })); });
      return s;
    },
    profit: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      s.appendChild(svg('path', { d: 'M8 56 L112 10', class: 'ln' }));
      s.appendChild(svg('path', { d: 'M8 36 L112 24', class: 'ln dim' }));
      s.appendChild(svg('circle', { cx: 57, cy: 34, r: 3.5, class: 'is-lit' }));
      return s;
    },
    cash: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      s.appendChild(svg('path', { d: 'M8 18 L22 22 L36 20 L50 34 L64 46 L78 38 L92 30 L106 24', class: 'ln' }));
      s.appendChild(svg('circle', { cx: 64, cy: 46, r: 3.5, class: 'is-lit' }));
      return s;
    },
    adtest: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      s.appendChild(svg('path', { d: 'M8 56 L30 46 L52 36 L74 24 L96 14', class: 'ln' }));
      s.appendChild(svg('path', { d: 'M8 56 L30 52 L52 44 L74 44 L96 36', class: 'ln dim' }));
      s.appendChild(svg('circle', { cx: 74, cy: 24, r: 3.5, class: 'is-lit' }));
      return s;
    },
    hooks: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      [10, 26, 42].forEach(function (y, i) { s.appendChild(svg('rect', { x: 10, y: y, width: [96, 70, 84][i], height: 8, rx: 4, class: i === 1 ? 'is-lit' : '' })); });
      return s;
    },
    ideas: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      [[10, 40], [30, 54], [50, 30], [70, 46]].forEach(function (b, i) { s.appendChild(svg('rect', { x: b[0], y: 60 - b[1], width: 12, height: b[1], rx: 3, class: i === 1 ? 'is-lit' : '' })); });
      return s;
    },
    checklists: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      [8, 26, 44].forEach(function (y, i) { s.appendChild(svg('rect', { x: 10, y: y, width: 12, height: 12, rx: 3, class: i === 2 ? 'is-lit' : '' })); s.appendChild(svg('rect', { x: 30, y: y + 3, width: [70, 56, 80][i], height: 6, rx: 3 })); });
      return s;
    },
    content: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      for (var r = 0; r < 3; r += 1) for (var c = 0; c < 5; c += 1) s.appendChild(svg('rect', { x: 10 + c * 21, y: 8 + r * 18, width: 15, height: 12, rx: 3, class: r === 1 && c === 2 ? 'is-lit' : '' }));
      return s;
    },
    stock: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      [[10, 88], [28, 34], [46, 70]].forEach(function (b, i) { s.appendChild(svg('rect', { x: 10, y: b[0], width: b[1], height: 8, rx: 4, class: i === 1 ? 'is-lit' : '' })); });
      s.appendChild(svg('path', { d: 'M40 4 L40 60', class: 'ln dim' }));
      return s;
    },
    hours: function () {
      var s = svg('svg', { viewBox: '0 0 120 64' });
      s.appendChild(svg('rect', { x: 10, y: 28, width: 46, height: 10, rx: 5 }));
      s.appendChild(svg('rect', { x: 60, y: 28, width: 32, height: 10, rx: 5, class: 'is-lit' }));
      s.appendChild(svg('rect', { x: 96, y: 28, width: 14, height: 10, rx: 5, class: 'dim' }));
      return s;
    },
  };
  function headline(id, d) {
    if (id === 'conversion' && d.weeks && d.weeks.length && d.steps.length > 1) {
      var w = d.weeks[0], a = +w.counts[d.steps[0].id] || 0, b = +w.counts[d.steps[d.steps.length - 1].id] || 0;
      return a ? T.pct((b / a) * 100) + ' end to end' : null;
    }
    if (id === 'profit' && d.price > 0) {
      var keep = d.price - d.unitCost - (d.price * d.feePct) / 100 - d.feeFlat;
      return keep > 0 && d.fixed > 0 ? 'Break even at ' + Math.ceil(d.fixed / keep) + ' sales' : 'Keep ' + T.money(keep, 2) + ' a sale';
    }
    if (id === 'cash') return 'Cash today ' + T.money(d.cash || 0, 0);
    if (id === 'adtest' && d.log && d.log.length) return d.log.length + ' days logged';
    if (id === 'hooks') return (d.stars || []).length + ' starred';
    if (id === 'ideas' && d.ideas && d.ideas.length) return d.ideas.length + ' ideas scored';
    if (id === 'content' && d.posts) { var n = Object.keys(d.posts).filter(function (k) { return d.posts[k].state === 'posted'; }).length; return n + ' posted this month'; }
    if (id === 'stock' && d.items && d.items.length) return d.items.length + ' products tracked';
    if (id === 'hours' && d.tasks && d.tasks.length) { var back = d.tasks.reduce(function (n, t) { return n + (t.tag !== 'me' ? +t.hours || 0 : 0); }, 0); return back + ' hrs a week to get back'; }
    if (id === 'checklists') return Object.keys(d.done || {}).length + ' steps done';
    return null;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tl-card'), function (card) {
    var id = card.getAttribute('data-tool'), art = card.querySelector('[data-art]');
    if (art && ART[id]) art.appendChild(ART[id]());
    var doc = card.querySelector('[data-doc]'), slot = card.querySelector('[data-headline]');
    if (!doc || !slot) return;
    try { var h = headline(id, JSON.parse(doc.textContent)); if (h) slot.textContent = h; } catch (e) { /* leave "Open" */ }
  });
})();
