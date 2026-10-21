// Life shelf (views/app/hq2/life.ejs): one small drawing per module card. Steel marks, one Pop mark each.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
  var ART = {
    budget: function (g) { [0.9, 0.55, 0.75, 0.3, 0.62].forEach(function (w, i) { g.appendChild(s('rect', { x: 0, y: i * 17, width: 170, height: 9, rx: 4.5, class: 'tr' })); g.appendChild(s('rect', { x: 0, y: i * 17, width: Math.round(170 * w), height: 9, rx: 4.5, class: i === 3 ? 'is-lit' : 'fl' })); }); },
    train: function (g) { [28, 40, 34, 52, 46, 70].forEach(function (h, i) { g.appendChild(s('rect', { x: i * 28, y: 84 - h, width: 16, height: h, rx: 4, class: i === 5 ? 'is-lit' : 'fl' })); }); },
    food: function (g) {
      var r = 34, c = 2 * Math.PI * r;
      g.appendChild(s('circle', { cx: 44, cy: 44, r: r, class: 'ring' }));
      g.appendChild(s('circle', { cx: 44, cy: 44, r: r, class: 'ring lit', 'stroke-dasharray': (c * 0.68).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 44 44)' }));
      [0.8, 0.5, 0.35].forEach(function (w, i) { g.appendChild(s('rect', { x: 100, y: 22 + i * 18, width: Math.round(70 * w), height: 8, rx: 4, class: 'fl' })); });
    },
    body: function (g) {
      var pts = [60, 52, 58, 44, 48, 36, 40, 30, 34, 22];
      g.appendChild(s('path', { d: pts.map(function (y, i) { return (i ? 'L' : 'M') + i * 19 + ' ' + y; }).join(' '), class: 'ln' }));
      g.appendChild(s('circle', { cx: 9 * 19, cy: 22, r: 5, class: 'is-lit' }));
    },
    faith: function (g) {
      // A reading plan as days: read days steel, today in Pop, the rest an outline.
      for (var i = 0; i < 21; i++) {
        var x = (i % 7) * 25, y = Math.floor(i / 7) * 28;
        g.appendChild(s('rect', { x: x, y: y, width: 17, height: 17, rx: 4, class: i < 12 ? 'fl' : i === 12 ? 'is-lit' : 'tr' }));
      }
    },
  };
  document.querySelectorAll('.lf-art[data-art]').forEach(function (n) {
    var f = ART[n.getAttribute('data-art')];
    if (!f) return;
    var v = s('svg', { viewBox: '-4 -4 182 96' });
    var defs = s('defs', {}), lg = s('linearGradient', { id: 'lf-pi', x1: 0, y1: 0, x2: 1, y2: 1 });
    var a = s('stop', { offset: '0%', 'stop-color': '#7c8cff' }), b = s('stop', { offset: '100%', 'stop-color': '#5be4ff' });
    lg.appendChild(a); lg.appendChild(b); defs.appendChild(lg); v.appendChild(defs);
    f(v);
    n.appendChild(v);
  });
})();
