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
