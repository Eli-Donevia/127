// Tape (lib/tape, HQ_TAPE): draws the watchlist, the chart and the member's flags from /app/hq/tape/data.
// Every sentence on the page comes from the server, already checked against Legal's word list (TK1); this script only
// draws numbers. Without the member's key the page runs on invented sample tickers, and the sample ticks on its own so
// the screen reads as a working one. With a key, prices refresh once a minute and the list every two (free plans allow
// a handful of calls a minute). The chart approach follows Bklit UI's charts (MIT, (c) 2026 uixmat), redrawn by hand.
(function () {
  'use strict';
  var stateEl = document.getElementById('tp-state');
  if (!stateEl) return;
  var ST = JSON.parse(stateEl.textContent);
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var S = { sel: ST.list[0] || null, tf: '1D', mode: 'line', ov: { vwap: true, sma: false }, scrub: -1, intro: true };
  try { var pref = JSON.parse(localStorage.getItem('tp-prefs') || 'null'); if (pref) { S.tf = pref.tf || S.tf; S.mode = pref.mode || S.mode; } } catch (e) { /* storage off */ }
  var D = {}; // `${sym}|${tf}` -> data
  var LIST = {}; // sym -> list data
  var G = {};

  function f2(x) { return x == null ? '–' : x >= 1000 ? x.toFixed(0) : x.toFixed(2); }
  function pct(x) { return x == null ? '' : (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(2) + '%'; }
  function money(x) { return '$' + f2(x); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtVol(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(Math.round(v || 0)); }
  var tzOpt = ST.live ? {} : { timeZone: 'America/Chicago' };
  function hm(t) { return new Date(t).toLocaleTimeString('en-US', Object.assign({ hour: 'numeric', minute: '2-digit' }, tzOpt)).replace(/\s?[AP]M/, ''); }
  function md(t) { return new Date(t).toLocaleDateString('en-US', Object.assign({ month: 'short', day: 'numeric' }, tzOpt)); }
  function wd(t) { return new Date(t).toLocaleDateString('en-US', Object.assign({ weekday: 'short' }, tzOpt)); }

  // ---------- data ----------
  function get(sym, tf) {
    // The sample keeps flag changes on this page, so they ride along for the server to word the notices.
    var q = ST.live ? '' : '&lv=' + encodeURIComponent((ST.levels[sym] || []).join(',')) + '&off=' + ST.ruleList.filter(function (r) { return !ST.rules[r[0]]; }).map(function (r) { return r[0]; }).join(',');
    return fetch('/app/hq/tape/data?sym=' + encodeURIComponent(sym) + '&tf=' + tf + q, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Prices did not load.'); return j; }); });
  }
  function load(sym, tf) {
    var k = sym + '|' + tf;
    if (D[k]) return Promise.resolve(D[k]);
    return get(sym, tf).then(function (d) { D[k] = d; return d; });
  }
  function cur() { return D[S.sel + '|' + S.tf] || null; }

  // ---------- chart ----------
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, style, anchor) { var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'start', style: style }, parent); t.textContent = s; return t; }
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
  function vwapSeries(bars, dayBreaks) { var pv = 0, vv = 0; return bars.map(function (b, i) { if (dayBreaks[i]) { pv = 0; vv = 0; } pv += (b.h + b.l + b.c) / 3 * b.v; vv += b.v; return vv ? pv / vv : b.c; }); }
  function dayKey(t) { return md(t); }

  function draw() {
    var d = cur(), svg = $('tp-main'), vs = $('tp-vol'), empty = $('tp-empty');
    svg.innerHTML = ''; vs.innerHTML = '';
    if (!d || !d.bars.length) { empty.hidden = false; empty.textContent = d ? 'No bars for this time frame.' : 'Loading prices…'; G = {}; return; }
    empty.hidden = true;
    var bars = d.bars, f = d.facts, intraday = (S.tf === '1D' && !d.fallback) || S.tf === '5D';
    var slots = S.tf === '1D' && !d.fallback ? 78 : bars.length;
    var W = svg.clientWidth || 360, H = svg.clientHeight || 250, VH = vs.clientHeight || 54;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); vs.setAttribute('viewBox', '0 0 ' + W + ' ' + VH);
    var padL = 14, padR = 58, padT = 16, padB = 22, cw = W - padL - padR, chh = H - padT - padB;
    var lo = Infinity, hi = -Infinity;
    bars.forEach(function (b) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
    var breaks = bars.map(function (b, i) { return i === 0 || dayKey(b.t) !== dayKey(bars[i - 1].t); });
    var vw = intraday ? vwapSeries(bars, breaks) : null;
    var lv = bars[bars.length - 1].c;
    var levels = (ST.levels[d.sym] || []);
    if (S.ov.sma && f.sma20) { lo = Math.min(lo, f.sma20); hi = Math.max(hi, f.sma20); }
    if (S.tf === '1D' && d.prev) { lo = Math.min(lo, d.prev); hi = Math.max(hi, d.prev); }
    levels.forEach(function (L) { if (L > lo * 0.92 && L < hi * 1.08) { lo = Math.min(lo, L); hi = Math.max(hi, L); } });
    var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    var X = function (i) { return padL + (slots <= 1 ? cw / 2 : i / (slots - 1) * cw); };
    var Y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * chh; };
    G = { X: X, Y: Y, bars: bars, W: W, padL: padL, cw: cw, slots: slots, H: H, padB: padB, padT: padT };
    var defs = el('defs', {}, svg);
    var ag = el('linearGradient', { id: 'tp-ag', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', style: 'stop-color:var(--tp-pop);stop-opacity:.32' }, ag);
    el('stop', { offset: '70%', style: 'stop-color:var(--tp-pop);stop-opacity:.05' }, ag);
    el('stop', { offset: '100%', style: 'stop-color:var(--tp-pop);stop-opacity:0' }, ag);
    var lg = el('linearGradient', { id: 'tp-lg', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0%', style: 'stop-color:var(--tp-pop)' }, lg);
    el('stop', { offset: '100%', style: 'stop-color:var(--tp-ion)' }, lg);
    var gl = el('filter', { id: 'tp-glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: 2.2, result: 'b' }, gl);
    var ct = el('feComponentTransfer', { in: 'b', result: 'bo' }, gl); el('feFuncA', { type: 'linear', slope: 0.5 }, ct);
    var mg = el('feMerge', {}, gl); el('feMergeNode', { in: 'bo' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);

    var lab = 'fill:var(--tp-faint);font:11px var(--tp-mono)';
    var tags = levels.concat([lv]);
    var step = niceStep((hi - lo) / 4);
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      el('line', { x1: padL, x2: W - padR + 6, y1: Y(v), y2: Y(v), style: 'stroke:var(--tp-line);stroke-width:1' }, svg);
      if (!tags.some(function (L) { return Math.abs(Y(L) - Y(v)) < 16; })) txt(svg, W - padR + 10, Y(v) + 4, f2(v), lab);
    }
    // x labels
    var xs;
    if (S.tf === '1D' && !d.fallback) xs = [0, 18, 36, 54, 72].map(function (i) { return [i, ST.live && !bars[i] ? '' : hm(bars[0].t + i * 300000)]; });
    else if (S.tf === '5D') xs = bars.map(function (b, i) { return breaks[i] ? [i, wd(b.t)] : null; }).filter(Boolean);
    else xs = [[0, md(bars[0].t)], [Math.floor(bars.length / 2), md(bars[Math.floor(bars.length / 2)].t)], [bars.length - 1, md(bars[bars.length - 1].t)]];
    xs.forEach(function (p, n) { if (p[1]) txt(svg, X(p[0]), H - 6, p[1], lab, n === 0 ? 'start' : 'middle'); });
    if (S.tf === '5D') breaks.forEach(function (b, i) { if (b && i) el('line', { x1: X(i), x2: X(i), y1: padT, y2: H - padB, style: 'stroke:var(--tp-line2);stroke-dasharray:2 4' }, svg); });
    if (d.halt && S.tf === '1D' && !d.fallback) {
      var hi0 = bars.findIndex(function (b) { return b.h === b.l && b.v === 0; });
      if (hi0 > 0) { el('rect', { x: X(hi0 - 0.5), y: padT, width: X(hi0 + 0.5) - X(hi0 - 0.5), height: chh, style: 'fill:var(--tp-warn-soft)' }, svg); txt(svg, X(hi0), padT + 10, 'paused', 'fill:var(--tp-warn);font:11px var(--tp-mono)', 'middle'); }
    }
    if (S.tf === '1D' && d.prev) { el('line', { x1: padL, x2: W - padR, y1: Y(d.prev), y2: Y(d.prev), style: 'stroke:var(--tp-faint);stroke-width:1;stroke-dasharray:1 4' }, svg); txt(svg, padL + 2, Y(d.prev) - 5, 'prev close ' + f2(d.prev), lab); }
    if (S.ov.sma && f.sma20) el('line', { x1: padL, x2: W - padR, y1: Y(f.sma20), y2: Y(f.sma20), style: 'stroke:var(--tp-warn);stroke-width:1.2;stroke-dasharray:6 4' }, svg);
    if (S.ov.vwap && vw) { var vp = ''; vw.forEach(function (x, i) { vp += (breaks[i] ? 'M' : 'L') + X(i) + ',' + Y(x); }); el('path', { d: vp, style: 'fill:none;stroke:var(--tp-muted);stroke-width:1.2;stroke-dasharray:5 3' }, svg); }
    levels.forEach(function (L) {
      if (L < lo || L > hi) return;
      el('line', { x1: padL, x2: W - padR, y1: Y(L), y2: Y(L), style: 'stroke:var(--tp-warn);stroke-width:1;stroke-dasharray:4 3' }, svg);
      el('rect', { x: W - padR + 4, y: Y(L) - 9, width: padR - 6, height: 18, rx: 5, style: 'fill:var(--tp-warn)' }, svg);
      txt(svg, W - padR + 8, Y(L) + 4, f2(L), 'fill:var(--tp-void);font:500 11px var(--tp-mono)');
    });
    var anim = S.intro && !RM;
    var up = lv >= (S.tf === '1D' && d.prev ? d.prev : bars[0].o);
    if (S.mode === 'line') {
      var p = '', base = Y(lo);
      bars.forEach(function (b, i) { p += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(b.c).toFixed(1); });
      el('path', { d: p + 'L' + X(bars.length - 1) + ',' + base + 'L' + X(0) + ',' + base + 'Z', fill: 'url(#tp-ag)', class: anim ? 'tp-fade' : '' }, svg);
      var ln = el('path', { d: p, style: 'fill:none;stroke:url(#tp-lg);stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;filter:var(--tp-bloom)' }, svg);
      if (anim && ln.getTotalLength) { ln.style.setProperty('--len', ln.getTotalLength()); ln.setAttribute('class', 'tp-draw'); }
    } else {
      var bw = Math.max(1.5, Math.min(10, cw / slots * 0.62));
      bars.forEach(function (b, i) {
        var col = b.c >= b.o ? 'var(--tp-up)' : 'var(--tp-down)';
        var g = el('g', { class: anim ? 'tp-grow' : '', style: anim ? 'animation-delay:' + Math.min(i * 12, 900) + 'ms' : '' }, svg);
        el('line', { x1: X(i), x2: X(i), y1: Y(b.h), y2: Y(b.l), style: 'stroke:' + col + ';stroke-width:1' }, g);
        el('rect', { x: X(i) - bw / 2, y: Y(Math.max(b.o, b.c)), width: bw, height: Math.max(1, Math.abs(Y(b.o) - Y(b.c))), rx: 1, style: 'fill:' + col }, g);
      });
    }
    var ex = X(bars.length - 1), ey = Y(lv), dot = S.mode === 'line' ? 'var(--tp-ion)' : (up ? 'var(--tp-up)' : 'var(--tp-down)');
    el('circle', { cx: ex, cy: ey, r: 4, class: anim ? 'tp-fade' : '', style: 'fill:' + dot + ';stroke:var(--tp-panel);stroke-width:2;filter:var(--tp-bloom)' }, svg);
    el('rect', { x: W - padR + 4, y: ey - 9, width: padR - 6, height: 18, rx: 5, style: 'fill:' + dot }, svg);
    txt(svg, W - padR + 8, ey + 4, f2(lv), 'fill:var(--tp-void);font:500 11px var(--tp-mono)');
    G.cross = el('g', { style: 'display:none' }, svg);
    G.cx = el('line', { y1: padT, y2: H - padB, style: 'stroke:var(--tp-muted);stroke-width:1;stroke-dasharray:2 3' }, G.cross);
    G.cd = el('circle', { r: 4.5, style: 'fill:var(--tp-fg);stroke:var(--tp-panel);stroke-width:2' }, G.cross);
    var vmax = Math.max.apply(null, bars.map(function (b) { return b.v; })) || 1, vbw = Math.max(1.2, cw / slots * 0.66);
    bars.forEach(function (b, i) {
      var h = b.v / vmax * (VH - 8);
      el('rect', { x: X(i) - vbw / 2, y: VH - h, width: vbw, height: Math.max(0, h), rx: 1, class: anim ? 'tp-grow' : '', style: 'fill:' + (b.c >= b.o ? 'var(--tp-up)' : 'var(--tp-down)') + ';fill-opacity:.42;' + (anim ? 'animation-delay:' + Math.min(300 + i * 8, 1200) + 'ms' : '') }, vs);
    });
    S.intro = false;
  }

  // scrub
  function scrubAt(clientX) {
    if (!G.X || !G.cross) return;
    var r = $('tp-main').getBoundingClientRect(), x = (clientX - r.left) * (G.W / r.width);
    var i = Math.round((x - G.padL) / G.cw * (G.slots - 1)); i = Math.max(0, Math.min(G.bars.length - 1, i));
    S.scrub = i; var b = G.bars[i];
    G.cross.style.display = '';
    G.cx.setAttribute('x1', G.X(i)); G.cx.setAttribute('x2', G.X(i)); G.cd.setAttribute('cx', G.X(i)); G.cd.setAttribute('cy', G.Y(b.c));
    var tip = $('tp-tip'); tip.textContent = 'O ' + f2(b.o) + '  H ' + f2(b.h) + '  L ' + f2(b.l) + '  Vol ' + fmtVol(b.v);
    tip.classList.add('on');
    var tw = tip.offsetWidth, px = G.X(i) / G.W * r.width; tip.style.left = Math.max(8, Math.min(r.width - tw - 8, px - tw / 2)) + 'px';
    quote(b);
  }
  function endScrub() { S.scrub = -1; if (G.cross) G.cross.style.display = 'none'; $('tp-tip').classList.remove('on'); quote(); }
  var cb = $('tp-chart');
  cb.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse' && !e.buttons && e.pointerType !== 'touch') return; scrubAt(e.clientX); });
  cb.addEventListener('pointerdown', function (e) { scrubAt(e.clientX); });
  cb.addEventListener('pointerleave', endScrub);
  cb.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') endScrub(); });
  cb.addEventListener('pointercancel', endScrub);

  // ---------- quote ----------
  var shown = '';
  function quote(b) {
    var d = cur(), sym = S.sel;
    var name = (d && d.name) || ST.names[sym] || '';
    $('tp-sym').innerHTML = esc(sym || '') + (name ? '<small>' + esc(name) + '</small>' : '');
    if (!d) { $('tp-price').textContent = ''; $('tp-delta').textContent = ''; $('tp-reads').innerHTML = ''; return; }
    var f = d.facts, lv = b ? b.c : (d.bars.length ? d.bars[d.bars.length - 1].c : f.last);
    var base = S.tf === '1D' && d.prev ? d.prev : (d.bars[0] ? d.bars[0].o : d.prev);
    var dd = lv - base, dp = base ? lv / base - 1 : 0;
    var str = f2(lv), pe = $('tp-price');
    if (str !== shown) {
      var old = shown; shown = str; pe.textContent = '$';
      for (var k = 0; k < str.length; k++) {
        var sp = document.createElement('span'); sp.className = 'd'; sp.textContent = str[k];
        if (!b && old && old[k] !== str[k] && !RM) { sp.style.transform = 'translateY(' + (str > old ? '' : '-') + '40%)'; sp.style.opacity = '0'; (function (n) { requestAnimationFrame(function () { requestAnimationFrame(function () { n.style.transform = ''; n.style.opacity = ''; }); }); })(sp); }
        pe.appendChild(sp);
      }
    }
    var label = b ? (S.tf === '1D' || S.tf === '5D' ? wd(b.t) + ' ' + hm(b.t) : md(b.t)) : { '1D': 'today', '5D': 'past 5 days', '1M': 'past month', '3M': 'past 3 months' }[S.tf];
    $('tp-delta').innerHTML = '<span class="' + (dd >= 0 ? 'upc' : 'dnc') + '">' + (dd >= 0 ? '+' : '−') + f2(Math.abs(dd)) + ' (' + pct(dp) + ')</span><span class="dim">' + esc(label) + '</span>';
    $('tp-when').textContent = b ? '' : (d.sample ? '10:42 CT' : hm(d.bars.length ? d.bars[d.bars.length - 1].t : Date.now()));
    var R = [];
    if (f.hi != null) R.push(['Range', money(f.lo) + '–' + money(f.hi)]);
    if (f.relVol != null) R.push(['Rel. volume', f.relVol.toFixed(1) + 'x']);
    if (f.rsi != null) R.push(['RSI 14', f.rsi.toFixed(0)]);
    if (f.sigma != null) R.push(['Typical day', '±' + (f.sigma * 100).toFixed(1) + '%']);
    $('tp-reads').innerHTML = R.map(function (p) { return '<span>' + p[0] + ' <b>' + p[1] + '</b></span>'; }).join('');
  }

  // ---------- notices and read (sentences from the server) ----------
  var ICON = {
    info: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" style="fill:none;stroke:var(--tp-ion);stroke-width:1.6"/></svg>',
    caution: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L11.5 10.8 H0.5 Z" style="fill:var(--tp-warn)"/></svg>',
    high: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" style="fill:var(--tp-down)"/></svg>',
    up: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 L10.5 8 H1.5 Z" style="fill:var(--tp-up)"/></svg>'
  };
  var notesKey = '', readKey = '';
  function notes() {
    var d = cur(); if (!d) return;
    var k = d.sym + JSON.stringify(d.notices);
    if (k === notesKey) return; notesKey = k;
    $('tp-notes').innerHTML = d.notices.map(function (n, i) { return '<div class="tp-note" style="animation-delay:' + i * 70 + 'ms">' + (ICON[n.sev] || ICON.info) + '<p>' + esc(n.title) + '<span>' + esc(n.line) + '</span></p><time>' + esc(n.at || '') + '</time></div>'; }).join('');
  }
  function read(animate) {
    var d = cur(); if (!d) return;
    var t = d.read.join(' ');
    if (t === readKey) return; readKey = t;
    var lastT = d.bars.length ? d.bars[d.bars.length - 1].t : null;
    $('tp-asof').textContent = d.sample ? 'As of 10:42 CT' : lastT ? 'As of ' + md(lastT) + ', ' + hm(lastT) : '';
    var o = $('tp-read');
    if (!animate || RM) { o.textContent = t; return; }
    o.innerHTML = t.split(' ').map(function (w, i) { return '<span class="tp-w" style="animation-delay:' + Math.min(i * 34, 1800) + 'ms">' + esc(w) + '</span>'; }).join(' ');
  }

  // ---------- tape strip and watchlist ----------
  function spark(d) {
    var b = d.bars; if (!b || b.length < 2) return '';
    var w = 64, h = 24, lo = Math.min(d.prev || Infinity, Math.min.apply(null, b.map(function (x) { return x.l; }))), hi = Math.max(d.prev || -Infinity, Math.max.apply(null, b.map(function (x) { return x.h; })));
    var n = d.sample ? 77 : b.length - 1;
    var pts = b.map(function (x, i) { return (i / n * w).toFixed(1) + ',' + (h - 2 - (x.c - lo) / (hi - lo || 1) * (h - 4)).toFixed(1); }).join(' ');
    return '<svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true"><polyline points="' + pts + '" style="fill:none;stroke:' + ((d.facts.chgPct || 0) >= 0 ? 'var(--tp-up)' : 'var(--tp-down)') + ';stroke-width:1.4"/></svg>';
  }
  function lists(flash) {
    $('tp-tape').innerHTML = ST.list.map(function (sym) {
      var d = LIST[sym], f = d ? d.facts : null, c = f ? f.chgPct : null, fl = flash && flash[sym] ? (flash[sym] > 0 ? ' tp-flash-up' : ' tp-flash-dn') : '';
      return '<button type="button" class="tp-chip' + fl + '" data-s="' + esc(sym) + '" aria-pressed="' + (sym === S.sel) + '"><span class="s">' + esc(sym) + '</span><span class="p">' + (f ? f2(f.last) : '…') + '</span><span class="c ' + ((c || 0) >= 0 ? 'upc' : 'dnc') + '">' + (c != null ? pct(c) : '&nbsp;') + '</span></button>';
    }).join('');
    $('tp-wl').innerHTML = ST.list.map(function (sym) {
      var d = LIST[sym], f = d ? d.facts : null, c = f ? f.chgPct : null, nl = (ST.levels[sym] || []).length;
      return '<tr data-s="' + esc(sym) + '" aria-selected="' + (sym === S.sel) + '" tabindex="0"><td><span class="s">' + esc(sym) + '</span><span class="n">' + esc(ST.names[sym] || (d && d.name) || '') + '</span></td><td>' + (d ? spark(d) : '') + '</td><td class="r">' + (f ? f2(f.last) : '…') + '<span class="rv">' + (f && f.relVol != null ? f.relVol.toFixed(1) + 'x vol' : '&nbsp;') + '</span></td><td class="r ' + ((c || 0) >= 0 ? 'upc' : 'dnc') + '">' + (c != null ? pct(c) : '') + '<span class="rv">' + (nl ? nl + ' level' + (nl > 1 ? 's' : '') : '&nbsp;') + '</span></td>' + (ST.live ? '<td class="r"><button type="button" class="x" data-rm="' + esc(sym) + '" aria-label="Remove ' + esc(sym) + '">Remove</button></td>' : '') + '</tr>';
    }).join('');
  }
  function select(sym) {
    if (!sym || sym === S.sel) return;
    S.sel = sym; S.intro = true; shown = ''; notesKey = ''; readKey = '';
    show(true);
    if (window.innerWidth < 960) window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
  }
  $('tp-tape').addEventListener('click', function (e) { var b = e.target.closest('.tp-chip'); if (b) select(b.dataset.s); });
  $('tp-wl').addEventListener('click', function (e) {
    var x = e.target.closest('[data-rm]');
    if (x) { e.stopPropagation(); var s = x.dataset.rm; ST.list = ST.list.filter(function (y) { return y !== s; }); delete LIST[s]; if (S.sel === s) { S.sel = ST.list[0] || null; S.intro = true; } persist(); lists(); show(true); return; }
    var r = e.target.closest('tr'); if (r) select(r.dataset.s);
  });
  $('tp-wl').addEventListener('keydown', function (e) { var r = e.target.closest('tr'); if (r && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) { e.preventDefault(); select(r.dataset.s); } });
  var addSym = $('tp-addsym');
  if (addSym) addSym.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('tp-symin').value.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(v)) { $('tp-symin').focus(); return; }
    $('tp-symin').value = '';
    if (ST.list.indexOf(v) < 0) { ST.list.push(v); persist(); }
    lists(); listOne(v); select(v);
  });

  // ---------- flags ----------
  function flags() {
    $('tp-fsym').textContent = S.sel || '';
    $('tp-rules').innerHTML = ST.ruleList.map(function (r) { return '<div class="row"><span>' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></span><button type="button" class="tp-sw" role="switch" aria-label="' + esc(r[1]) + '" aria-checked="' + !!ST.rules[r[0]] + '" data-k="' + r[0] + '"></button></div>'; }).join('');
    $('tp-levels').innerHTML = (ST.levels[S.sel] || []).map(function (L, i) { return '<div class="tp-lvl"><span>Level ' + money(L) + '</span><button type="button" data-i="' + i + '" aria-label="Remove level ' + money(L) + '">Remove</button></div>'; }).join('');
    var d = cur(); if (d && d.facts.last) $('tp-lvlin').placeholder = 'Price level, e.g. ' + Math.round(d.facts.last * 1.05);
  }
  // Rule and level changes redraw the notices from the server's sentences on the next load.
  function refreshSel() { Object.keys(D).forEach(function (k) { if (k.indexOf(S.sel + '|') === 0) delete D[k]; }); notesKey = ''; return load(S.sel, S.tf).then(function () { notes(); draw(); }); }
  $('tp-rules').addEventListener('click', function (e) { var b = e.target.closest('.tp-sw'); if (!b) return; ST.rules[b.dataset.k] = !ST.rules[b.dataset.k]; b.setAttribute('aria-checked', ST.rules[b.dataset.k]); persist().then(refreshSel); });
  $('tp-levels').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; ST.levels[S.sel].splice(+b.dataset.i, 1); if (!ST.levels[S.sel].length) delete ST.levels[S.sel]; flags(); lists(); persist().then(refreshSel); });
  $('tp-addlvl').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = parseFloat($('tp-lvlin').value.replace(/[$,]/g, ''));
    if (!(v > 0)) { $('tp-lvlin').focus(); return; }
    (ST.levels[S.sel] = ST.levels[S.sel] || []).push(v); $('tp-lvlin').value = '';
    flags(); lists(); persist().then(refreshSel);
  });

  // Saves the watchlist, levels and flags (Builder and a connected key). The sample keeps changes on this page only.
  function persist() {
    if (!ST.live) return Promise.resolve();
    return fetch('/app/hq/tape/save', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list: ST.list, levels: ST.levels, rules: ST.rules }) })
      .then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  // ---------- controls ----------
  function seg(id, key) {
    var g = $(id), knob = g.querySelector('.tp-knob');
    function place() { var on = g.querySelector('[aria-pressed="true"]'); if (on) { knob.style.left = on.offsetLeft + 'px'; knob.style.width = on.offsetWidth + 'px'; } }
    g.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === S[key])); });
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.dataset.v === S[key]) return;
      S[key] = b.dataset.v; g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); place();
      try { localStorage.setItem('tp-prefs', JSON.stringify({ tf: S.tf, mode: S.mode })); } catch (err) { /* storage off */ }
      S.intro = true; shown = ''; show(false);
    });
    requestAnimationFrame(place); window.addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place);
  }
  seg('tp-tf', 'tf'); seg('tp-mode', 'mode');
  $('tp-ovs').addEventListener('click', function (e) { var b = e.target.closest('.tp-ov'); if (!b) return; var k = b.dataset.k; S.ov[k] = !S.ov[k]; b.setAttribute('aria-pressed', String(S.ov[k])); draw(); });

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'tp-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.querySelector('.tp').appendChild(t); setTimeout(function () { t.remove(); }, 6000);
  }

  function show(animateRead) {
    if (!S.sel) { draw(); quote(); $('tp-notes').innerHTML = ''; $('tp-read').textContent = ST.live ? 'Add a ticker to your watchlist to start.' : ''; flags(); return; }
    lists(); flags(); quote(); draw();
    var sym = S.sel, tf = S.tf;
    load(sym, tf).then(function () { if (S.sel !== sym || S.tf !== tf) return; quote(); draw(); notes(); read(animateRead); flags(); })
      .catch(function (err) { if (S.sel !== sym) return; $('tp-empty').hidden = false; $('tp-empty').textContent = err.message; });
  }

  function listOne(sym) {
    return get(sym, 'list').then(function (d) {
      var before = LIST[sym] && LIST[sym].facts.last;
      LIST[sym] = d;
      // An alert while HQ is open: one of the member's levels was crossed since the last refresh.
      if (ST.live && ST.rules.cross && before != null && d.facts.last != null) (ST.levels[sym] || []).forEach(function (L) { if ((before - L) * (d.facts.last - L) < 0) toast(sym + ' reached your level ' + money(L)); });
      lists();
    }).catch(function () { /* the row keeps its dots */ });
  }
  function loadList() {
    var chain = Promise.resolve();
    ST.list.forEach(function (sym) { chain = chain.then(function () { return listOne(sym); }); });
    return chain;
  }

  show(true);
  loadList();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(draw, 120); });

  if (ST.live) {
    // Once a minute for the open symbol, every two minutes for the list, and never in a hidden tab.
    setInterval(function () { if (document.hidden || !S.sel) return; delete D[S.sel + '|' + S.tf]; if (S.scrub < 0) show(false); }, 60000);
    setInterval(function () { if (!document.hidden) loadList(); }, 120000);
  } else {
    // The sample feed: small ticks on the last bar, so the screen reads as a working one. Labeled "Sample data".
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
    setInterval(function () {
      if (document.hidden) return;
      var flash = {};
      Object.keys(D).concat(Object.keys(LIST).map(function (s) { return s + '|list'; })).forEach(function (k) {
        var d = k.slice(-5) === '|list' ? LIST[k.slice(0, -5)] : D[k];
        if (!d || !d.bars.length || (d.tf !== '1D' && d.tf !== 'list')) return;
        var b = d.bars[d.bars.length - 1], was = b.c;
        b.c = +(b.c * (1 + rnd() * 0.0016)).toFixed(4); b.h = Math.max(b.h, b.c); b.l = Math.min(b.l, b.c);
        d.facts.last = b.c; d.facts.hi = Math.max(d.facts.hi, b.c); d.facts.lo = Math.min(d.facts.lo, b.c);
        d.facts.chgPct = d.prev ? b.c / d.prev - 1 : d.facts.chgPct;
        if (d.tf === 'list') flash[d.sym] = Math.sign(b.c - was);
      });
      lists(flash);
      if (S.scrub < 0) { quote(); draw(); }
    }, 2600);
  }
})();
