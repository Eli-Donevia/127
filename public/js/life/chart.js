/*!
 * chart.js: interactive charts and simple forecasts for Life in HQ (public/js/life), plain SVG, no libraries.
 *
 * Ideas and math follow Bklit UI's chart kit (github.com/bklit/bklit-ui, packages/ui charts, MIT (c) 2026 uixmat,
 * licence in vendor/LICENSE-bklit): mean-centred least squares (trend-line-utils.ts), a dashed projection from the last
 * real point to the horizon with an end marker (projection-line.tsx), a crosshair that snaps to the nearest point
 * (use-chart-interaction.ts), a reference line for a target (reference-area.tsx) and a clip that reveals the series
 * left to right (chart-reveal-clip.tsx). 127 changes: vanilla DOM, tap and drag on phones, arrow keys, the forecast
 * carries a widening band from the fit's own error, colours from the Life accent tokens, reduced motion paints still.
 *
 *   Life.chart(host, {
 *     kind: 'area' | 'line' | 'bar',
 *     points: [{ label: 'Oct 3', y: 12 | null, flag: 'Three short nights' }],   // one per slot, future slots y: null
 *     forecast: { from: 9, window: 14, floor: 0 } | [{ i, y }],                  // fit the last `window` points, or given
 *     target: 8, targetLabel: 'Goal', avg: [y, ...], fmt: (v) => '8 h', unit: 'h', height: 180, lit: 9,
 *   })
 * Returns { forecast: [{ i, y, lo, hi }], fit } so a module can say what the forecast means.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0, seen = {};
  function s(tag, a) { var e = document.createElementNS(NS, tag); if (a) Object.keys(a).forEach(function (k) { if (a[k] != null) e.setAttribute(k, a[k]); }); return e; }

  // Ordinary least squares, mean-centred (Bklit trend-line-utils.ts). Returns null for fewer than two points.
  function fit(pts) {
    var n = 0, sx = 0, sy = 0;
    pts.forEach(function (p) { if (isFinite(p.x) && isFinite(p.y)) { n++; sx += p.x; sy += p.y; } });
    if (n < 2) return null;
    var mx = sx / n, my = sy / n, cxy = 0, vx = 0;
    pts.forEach(function (p) { if (isFinite(p.x) && isFinite(p.y)) { var dx = p.x - mx; cxy += dx * (p.y - my); vx += dx * dx; } });
    if (!vx) return null;
    var slope = cxy / vx, icept = my - slope * mx, se = 0;
    pts.forEach(function (p) { if (isFinite(p.x) && isFinite(p.y)) { var r = p.y - (slope * p.x + icept); se += r * r; } });
    return { slope: slope, intercept: icept, sd: Math.sqrt(se / Math.max(1, n - 2)), n: n, at: function (x) { return slope * x + icept; } };
  }

  // Forecast the slots after `from` from a fit of the last `window` real points. The band widens with distance.
  function project(points, o) {
    var from = o.from != null ? o.from : lastReal(points);
    var w = o.window || 14, pts = [];
    for (var i = Math.max(0, from - w + 1); i <= from; i++) if (points[i] && points[i].y != null) pts.push({ x: i, y: points[i].y });
    var f = fit(pts);
    if (!f || pts.length < (o.min || 4)) return { forecast: [], fit: f };
    var out = [{ i: from, y: points[from].y, lo: points[from].y, hi: points[from].y }];
    for (var k = from + 1; k < points.length; k++) {
      var y = f.at(k), spread = 1.28 * f.sd * Math.sqrt(1 + (k - from) / Math.max(4, pts.length));
      if (o.floor != null) y = Math.max(o.floor, y);
      out.push({ i: k, y: y, lo: o.floor != null ? Math.max(o.floor, y - spread) : y - spread, hi: y + spread });
    }
    return { forecast: out, fit: f };
  }
  function lastReal(points) { for (var i = points.length - 1; i >= 0; i--) if (points[i].y != null) return i; return -1; }

  function chart(host, o) {
    var id = ++uid, points = o.points || [], n = points.length;
    var fmt = o.fmt || function (v) { return Math.round(v).toLocaleString('en-US'); };
    var res = Array.isArray(o.forecast) ? { forecast: o.forecast, fit: null } : o.forecast ? project(points, o.forecast) : { forecast: [], fit: null };
    var last = lastReal(points), lit = o.lit != null ? o.lit : last;
    host.classList.add('lc');
    host.innerHTML = '';
    host.setAttribute('tabindex', '0');
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', (o.aria || 'Chart') + (last >= 0 ? ', latest ' + points[last].label + ' ' + fmt(points[last].y) : '') + (res.forecast.length > 1 ? ', forecast ' + fmt(res.forecast[res.forecast.length - 1].y) + ' by ' + points[n - 1].label : ''));
    var tip = document.createElement('div');
    tip.className = 'lc-tip';
    tip.hidden = true;
    // Reveal once per chart key a page load, so redraws as the member types don't replay it.
    var drawn = !!(o.key && seen[o.key]), sel = -1, geo = null;
    if (o.key) seen[o.key] = 1;

    function draw() {
      var W = Math.max(240, Math.round(host.clientWidth || 340)), H = o.height || 180, top = 14, bot = 22, right = 40;
      var vals = [];
      points.forEach(function (p) { if (p.y != null) vals.push(p.y); });
      res.forecast.forEach(function (f) { vals.push(f.hi, f.lo); });
      (o.avg || []).forEach(function (v) { if (v != null) vals.push(v); });
      if (o.target) vals.push(o.target);
      var lo = o.zero === false && vals.length ? Math.min.apply(null, vals) : 0, hi = vals.length ? Math.max.apply(null, vals) : 1;
      if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
      var pad = (hi - lo) * 0.08; hi += pad; if (o.zero === false) lo -= pad;
      var plotW = W - right, step = n > 1 ? plotW / (o.kind === 'bar' ? n : n - 1) : plotW;
      var x = function (i) { return o.kind === 'bar' ? step * i + step / 2 : step * i; };
      var y = function (v) { return top + (H - top - bot) * (1 - (v - lo) / (hi - lo)); };
      geo = { x: x, y: y, W: W, H: H, step: step, plotW: plotW };

      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'lc-svg', 'aria-hidden': 'true' });
      var defs = s('defs');
      var grad = s('linearGradient', { id: 'lc-g' + id, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.appendChild(s('stop', { offset: '0%', class: 'lc-g0' }));
      grad.appendChild(s('stop', { offset: '100%', class: 'lc-g1' }));
      var clip = s('clipPath', { id: 'lc-c' + id });
      var clipR = s('rect', { x: -4, y: 0, width: drawn || reduce ? W + 8 : 0, height: H });
      clip.appendChild(clipR);
      // The line runs Pop to Ion across the subject (D56).
      var lineG = s('linearGradient', { id: 'lc-l' + id, x1: 0, y1: 0, x2: 1, y2: 0 });
      lineG.appendChild(s('stop', { offset: '0%', class: 'lc-p0' }));
      lineG.appendChild(s('stop', { offset: '100%', class: 'lc-p1' }));
      defs.appendChild(grad); defs.appendChild(lineG); defs.appendChild(clip); svg.appendChild(defs);

      // Grid: three quiet lines with values on the right edge.
      [0, 0.5, 1].forEach(function (t) {
        var v = lo + (hi - lo) * t, yy = y(v);
        svg.appendChild(s('line', { x1: 0, x2: plotW, y1: yy, y2: yy, class: 'lc-grid' }));
        var tx = s('text', { x: W - 2, y: yy + 3, 'text-anchor': 'end', class: 'lc-ax' }); tx.textContent = fmt(v); svg.appendChild(tx);
      });
      // X labels: first, middle, last.
      [0, Math.floor((n - 1) / 2), n - 1].filter(function (v, i, a) { return a.indexOf(v) === i && points[v]; }).forEach(function (i, k, a) {
        var tx = s('text', { x: x(i), y: H - 6, 'text-anchor': k === 0 && o.kind !== 'bar' ? 'start' : k === a.length - 1 && o.kind !== 'bar' ? 'end' : 'middle', class: 'lc-ax' });
        tx.textContent = points[i].label; svg.appendChild(tx);
      });
      // Target: a dashed reference line with its label.
      if (o.target) {
        var ty = y(o.target);
        svg.appendChild(s('line', { x1: 0, x2: plotW, y1: ty, y2: ty, class: 'lc-target' }));
        var tl = s('text', { x: 2, y: ty - 5, class: 'lc-ax lc-target-t' }); tl.textContent = (o.targetLabel || 'Goal') + ' ' + fmt(o.target); svg.appendChild(tl);
      }

      var g = s('g', { 'clip-path': 'url(#lc-c' + id + ')' });
      if (o.kind === 'bar') {
        var bw = Math.max(4, Math.min(26, step * 0.62));
        points.forEach(function (p, i) {
          if (p.y == null) return;
          var yy = y(Math.max(p.y, lo)), h = Math.max(p.y ? 2 : 0, y(lo) - yy);
          g.appendChild(s('rect', { x: x(i) - bw / 2, y: y(lo) - h, width: bw, height: h, rx: Math.min(5, bw / 3), class: 'lc-bar' + (i === lit ? ' is-lit' : '') + (p.flag ? ' is-flag' : '') }));
        });
      } else {
        var segs = [], cur = [];
        points.forEach(function (p, i) { if (p.y != null) cur.push([x(i), y(p.y)]); else if (cur.length) { segs.push(cur); cur = []; } });
        if (cur.length) segs.push(cur);
        segs.forEach(function (sg) {
          var d = sg.map(function (q, k) { return (k ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
          if (o.kind === 'area' && sg.length > 1) g.appendChild(s('path', { d: d + ' L' + sg[sg.length - 1][0].toFixed(1) + ' ' + y(lo).toFixed(1) + ' L' + sg[0][0].toFixed(1) + ' ' + y(lo).toFixed(1) + ' Z', fill: 'url(#lc-g' + id + ')', class: 'lc-area' }));
          g.appendChild(s('path', { d: d, class: 'lc-line', stroke: 'url(#lc-l' + id + ')' }));
          if (sg.length === 1) g.appendChild(s('circle', { cx: sg[0][0], cy: sg[0][1], r: 2.5, class: 'lc-dot' }));
        });
      }
      if (o.avg) {
        var ad = '', on = false;
        o.avg.forEach(function (v, i) { if (v == null) { on = false; return; } ad += (on ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; on = true; });
        if (ad) g.appendChild(s('path', { d: ad, class: 'lc-avg' }));
      }
      // Forecast: the band, then the dashed line, then the end marker.
      if (res.forecast.length > 1) {
        var fc = res.forecast;
        g.appendChild(s('path', { d: fc.map(function (f, k) { return (k ? 'L' : 'M') + x(f.i).toFixed(1) + ' ' + y(f.hi).toFixed(1); }).join(' ') + ' ' + fc.slice().reverse().map(function (f) { return 'L' + x(f.i).toFixed(1) + ' ' + y(f.lo).toFixed(1); }).join(' ') + ' Z', class: 'lc-band' }));
        g.appendChild(s('path', { d: fc.map(function (f, k) { return (k ? 'L' : 'M') + x(f.i).toFixed(1) + ' ' + y(f.y).toFixed(1); }).join(' '), class: 'lc-proj' }));
        var end = fc[fc.length - 1];
        g.appendChild(s('circle', { cx: x(end.i), cy: y(end.y), r: 3.5, class: 'lc-proj-end' }));
      }
      // Flags: a small mark above the flagged slot.
      points.forEach(function (p, i) { if (p.flag && p.y != null) g.appendChild(s('path', { d: 'M' + x(i).toFixed(1) + ' ' + (top - 2) + ' l4 -6 h-8 z', class: 'lc-flag' })); });
      svg.appendChild(g);
      // The one lit point.
      if (lit >= 0 && points[lit] && points[lit].y != null && o.kind !== 'bar') svg.appendChild(s('circle', { cx: x(lit), cy: y(points[lit].y), r: 4.5, class: 'lc-lit' }));
      var hair = s('line', { x1: 0, x2: 0, y1: top - 4, y2: H - bot, class: 'lc-hair', visibility: 'hidden' });
      var knob = s('circle', { r: 4, class: 'lc-knob', visibility: 'hidden' });
      svg.appendChild(hair); svg.appendChild(knob);
      geo.hair = hair; geo.knob = knob;

      host.innerHTML = '';
      host.appendChild(svg);
      host.appendChild(tip);
      if (!drawn && !reduce) {
        var t0 = performance.now();
        (function grow(t) { var k = Math.max(0, Math.min(1, (t - t0) / 900)), e = 1 - Math.pow(1 - k, 4); clipR.setAttribute('width', (W + 8) * e); if (k < 1) requestAnimationFrame(grow); })(t0);
      }
      drawn = true;
      if (sel >= 0) show(sel);
    }

    function fcAt(i) { for (var k = 0; k < res.forecast.length; k++) if (res.forecast[k].i === i) return res.forecast[k]; return null; }
    function show(i) {
      if (!geo || i < 0 || i >= n) return;
      sel = i;
      var p = points[i], f = fcAt(i), real = p.y != null, v = real ? p.y : f ? f.y : null;
      var xx = geo.x(i);
      geo.hair.setAttribute('x1', xx); geo.hair.setAttribute('x2', xx); geo.hair.setAttribute('visibility', 'visible');
      if (v != null) { geo.knob.setAttribute('cx', xx); geo.knob.setAttribute('cy', geo.y(v)); geo.knob.setAttribute('visibility', 'visible'); geo.knob.setAttribute('class', 'lc-knob' + (real ? '' : ' is-proj')); }
      else geo.knob.setAttribute('visibility', 'hidden');
      tip.innerHTML = '';
      var b = document.createElement('b'); b.textContent = v == null ? '–' : fmt(v) + (o.unit ? ' ' + o.unit : '');
      var l = document.createElement('span'); l.textContent = p.label + (real ? '' : f ? ' · forecast' : '');
      tip.appendChild(l); tip.appendChild(b);
      if (!real && f && isFinite(f.lo)) { var r = document.createElement('span'); r.className = 'lc-tip-r'; r.textContent = 'Likely ' + fmt(f.lo) + ' to ' + fmt(f.hi); tip.appendChild(r); }
      if (o.avg && o.avg[i] != null) { var a = document.createElement('span'); a.className = 'lc-tip-r'; a.textContent = (o.avgLabel || '7-day average') + ' ' + fmt(o.avg[i]); tip.appendChild(a); }
      if (p.flag) { var fl = document.createElement('span'); fl.className = 'lc-tip-f'; fl.textContent = p.flag; tip.appendChild(fl); }
      if (p.note) { var nt = document.createElement('span'); nt.className = 'lc-tip-r'; nt.textContent = p.note; tip.appendChild(nt); }
      tip.hidden = false;
      var tw = tip.offsetWidth || 120, left = Math.min(Math.max(0, (xx / geo.W) * host.clientWidth - tw / 2), host.clientWidth - tw);
      tip.style.transform = 'translateX(' + Math.round(left) + 'px)';
    }
    function hide() { sel = -1; tip.hidden = true; if (geo) { geo.hair.setAttribute('visibility', 'hidden'); geo.knob.setAttribute('visibility', 'hidden'); } }
    function at(e) {
      var r = host.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * geo.W;
      var i = o.kind === 'bar' ? Math.floor(px / geo.step) : Math.round(px / geo.step);
      return Math.max(0, Math.min(n - 1, i));
    }
    var dragging = false;
    host.addEventListener('pointerdown', function (e) { dragging = true; show(at(e)); });
    host.addEventListener('pointermove', function (e) { if (dragging || e.pointerType === 'mouse') show(at(e)); });
    host.addEventListener('pointerup', function () { dragging = false; });
    host.addEventListener('pointerleave', function (e) { dragging = false; if (e.pointerType === 'mouse') hide(); });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.key === 'Escape') return hide();
      show(Math.max(0, Math.min(n - 1, (sel < 0 ? lit : sel) + (e.key === 'ArrowRight' ? 1 : -1))));
    });
    host.addEventListener('blur', hide);
    draw();
    if ('ResizeObserver' in window) { var rt = null, w0 = host.clientWidth; new ResizeObserver(function () { if (Math.abs(host.clientWidth - w0) < 2) return; w0 = host.clientWidth; clearTimeout(rt); rt = setTimeout(draw, 120); }).observe(host); }
    return res;
  }

  // Notices: caution first, then info, then good. At most `max`.
  function notices(host, list, max) {
    var order = { caution: 0, info: 1, good: 2 };
    var items = list.filter(Boolean).sort(function (a, b) { return order[a.tone] - order[b.tone]; }).slice(0, max || 3);
    if (!items.length) return null;
    var ul = document.createElement('ul');
    ul.className = 'lf-notes';
    items.forEach(function (n) {
      var li = document.createElement('li');
      li.className = 'lf-notice is-' + n.tone;
      var t = document.createElement('b'); t.textContent = n.title;
      li.appendChild(t);
      if (n.body) { var p = document.createElement('span'); p.textContent = n.body; li.appendChild(p); }
      ul.appendChild(li);
    });
    host.appendChild(ul);
    return ul;
  }

  window.LifeChart = { chart: chart, fit: fit, project: project, notices: notices };
})();
