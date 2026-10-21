/* The Day One Challenge share card: a 1080x1920 story card drawn on a canvas.
   Layout and colours follow the Graphics team's shareCard() (graphics/src/assets-challenge.mjs).
   API: window.C127Card.draw(opts) / toBlob(canvas) / mount(root). Every [data-card] is mounted on load. */
(function () {
  'use strict';
  var W = 1080, H = 1920, CX = W / 2, PAD = 96, IMG = '/challenge-assets/img/';
  var SANS = 'Geist, "Helvetica Neue", Arial, sans-serif', MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  var INK = '#ededf2', FOG = '#b4b4be', SLATE = '#7e7e89', SIGNAL = '#7cebf6', BG = '#060607';
  var STEEL = [[0, '#ffffff'], [0.55, '#c9cad3'], [1, '#7f808c']], DIM = [[0, '#8f92a0'], [1, '#616472']];
  var MOVES = ['Pick one', 'Find 10 people', 'Have the conversation', 'Write the offer', 'Ask for a yes'];
  var LABELS = { 1: 'Day 1 \u00b7 Picked one', 2: 'Day 2 \u00b7 10 names, 3 asks', 3: 'Day 3 \u00b7 Had the conversation', 4: 'Day 4 \u00b7 Wrote the offer', 5: 'Day 5 \u00b7 Asked for a yes', finisher: 'Day One finisher \u00b7 5 of 5' };
  var SHARE_TEXT = 'I made today day one. The Day One Challenge with Eli Christiansen: 127group.io/challenge';
  var FONTS = ['600 260px "Geist Mono"', '400 19px "Geist Mono"', '700 100px Geist', '600 21px Geist', '500 24px Geist', '400 30px Geist'];

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function race(p, ms) { return Promise.race([p, wait(ms)]); }

  // Fonts: the card needs Geist Mono 600 for the day number. Add it if the page's Google Fonts link lacks it.
  var fontsReady;
  function loadFonts() {
    if (fontsReady) return fontsReady;
    if (!document.fonts || !document.fonts.load) return (fontsReady = Promise.resolve());
    var links = document.querySelectorAll('link[href*="fonts.googleapis.com"]'), has = false;
    for (var i = 0; i < links.length; i++) if (/Geist\+Mono[^&]*600/.test(links[i].href)) has = true;
    var css = has ? Promise.resolve() : new Promise(function (res) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.onload = l.onerror = res;
      l.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;600&display=swap';
      document.head.appendChild(l); setTimeout(res, 2500);
    });
    fontsReady = css.then(function () {
      return race(Promise.all(FONTS.map(function (f) { return document.fonts.load(f); })), 4000);
    }).catch(function () {});
    return fontsReady;
  }

  var imgs = {};
  function loadImg(name) {
    if (!imgs[name]) imgs[name] = race(new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var done = function () { resolve(img); };
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = function () { resolve(null); };
      img.src = IMG + name;
    }), 6000).then(function (img) { if (!img) delete imgs[name]; return img || null; });
    return imgs[name];
  }

  // ---------- drawing helpers ----------
  function grad(x, y0, y1, stops) {
    var g = x.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }
  function chars(t) { return Array.from(t); }
  // Width as CSS lays it out: kerned advance plus letter-spacing after every character.
  function textW(x, t, ls) { return x.measureText(t).width + ls * chars(t).length; }
  function drawSpaced(x, t, left, y, ls) {
    if (!ls) return x.fillText(t, left, y);
    var c = chars(t);
    for (var i = 0; i < c.length; i++) x.fillText(c[i], left + x.measureText(c.slice(0, i).join('')).width + ls * i, y);
  }
  function center(x, t, y, ls, cx) { drawSpaced(x, t, (cx || CX) - textW(x, t, ls) / 2, y, ls); }
  function ellipsize(x, t, max, ls) {
    var c = chars(t);
    while (c.length > 1 && textW(x, c.join('') + '\u2026', ls) > max) c.pop();
    return c.join('').replace(/[\s.,;:\u00b7-]+$/, '') + '\u2026';
  }
  function fit(x, t, max, ls) { return textW(x, t, ls) <= max ? t : ellipsize(x, t, max, ls); }
  function wrap(x, t, max, ls, maxLines) {
    var words = t.split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (cur && textW(x, test, ls) > max) { lines.push(cur); cur = w; } else cur = test;
    });
    if (cur) lines.push(cur);
    lines = lines.map(function (l) { return fit(x, l, max, ls); });
    if (maxLines && lines.length > maxLines) {
      var close = t.slice(-1) === '\u201d' ? '\u201d' : '';
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsize(x, lines[maxLines - 1], max - textW(x, close, ls), ls) + close;
    }
    return lines;
  }
  // Like CSS text-wrap: balance. Narrow the measure while the line count holds, so a quote has no one-word last line.
  function balanced(x, t, max, maxLines) {
    var lines = wrap(x, t, max, 0, maxLines), lo = max / 2, hi = max;
    if (lines.length < 2 || wrap(x, t, max, 0).length > maxLines) return lines;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      if (wrap(x, t, mid, 0).length > lines.length) lo = mid; else hi = mid;
    }
    return wrap(x, t, hi, 0, maxLines);
  }
  function rrect(x, l, t, w, h, r) {
    x.beginPath(); x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  }

  // Near-black, faint 90px grid fading out from the upper middle, lavender glow from the top edge.
  // v2 (the page sets C127CardMoves): plain void, solid type. No backdrop glow, faint grid or gradient text
  // (the premium pass and the Oct 20 accent system retire all three); the chrome 127 stays, it's a real material.
  function v2() { return !!window.C127CardMoves; }
  function ink(x, top, bottom, stops) { return v2() ? INK : grad(x, top, bottom, stops); }
  function background(x) {
    x.fillStyle = BG; x.fillRect(0, 0, W, H);
    if (v2()) return;
    x.save(); x.translate(CX, 0); x.scale(1, 575 / 450);
    var g = x.createRadialGradient(0, 0, 0, 0, 0, 450);
    for (var i = 0; i <= 10; i++) g.addColorStop(i / 10, 'rgba(124, 235, 246,' + (0.24 * Math.pow(1 - i / 10, 1.25)).toFixed(4) + ')');
    x.fillStyle = g; x.fillRect(-CX, 0, W, 470); x.restore();
    var seg = 6, gx, gy, p;
    for (gx = 45; gx < W; gx += 90) for (p = 0; p < 1152; p += seg) gridSeg(x, gx, p, 1, seg, gx, p + seg / 2);
    for (gy = 0; gy < 1152; gy += 90) for (p = 0; p < W; p += seg) gridSeg(x, p, gy, seg, 1, p + seg / 2, gy);
  }
  function gridSeg(x, l, t, w, h, px, py) {
    var dx = (px - 540) / 600, dy = (py - 375) / 775, m = Math.min(1, (1 - Math.sqrt(dx * dx + dy * dy)) / 0.9);
    if (m <= 0) return;
    x.fillStyle = 'rgba(255,255,255,' + (0.042 * m).toFixed(4) + ')';
    x.fillRect(l, t, w, h);
  }

  function steelMark(x, img, top) {
    var w = 86.4, h = 43.2;
    if (img) {
      var o = document.createElement('canvas'); o.width = 88; o.height = 44;
      var ox = o.getContext('2d');
      ox.drawImage(img, 0.8, 0, w, h);
      ox.globalCompositeOperation = 'source-in';
      ox.fillStyle = grad(ox, 0, h, STEEL); ox.fillRect(0, 0, 88, 44);
      x.drawImage(o, 496, top);
      o.width = o.height = 0;
    } else {
      x.font = '700 60px ' + SANS; x.fillStyle = grad(x, top, top + h, STEEL);
      center(x, '127', top + h - 1, -3.6);
    }
  }

  function moveList() { return window.C127CardMoves || MOVES; }
  function dayTotal() { return moveList().length; }

  var STRIP = { gap: 13.44, padX: 17.92, padY: 20.16, row: 24.75, lh: 24.47, r: 22.4, font: '600 21.28px ' + SANS, ls: -0.4256 };
  // More than 5 days (the 14-day version): a streak grid of 7 a row, one row a week, no move names.
  var GRID = { cols: 7, gap: 12, h: 76, r: 18 };
  function gridLayout() {
    var rows = Math.ceil(dayTotal() / GRID.cols);
    return { grid: true, rows: rows, w: (W - PAD * 2 - GRID.gap * (GRID.cols - 1)) / GRID.cols, h: rows * GRID.h + (rows - 1) * GRID.gap };
  }
  function drawGrid(x, s, top, today, done) {
    top = Math.round(top);
    for (var i = 0; i < dayTotal(); i++) {
      var day = i + 1, row = Math.floor(i / GRID.cols), col = i % GRID.cols;
      var l = Math.round(PAD + col * (s.w + GRID.gap)), w = Math.round(PAD + col * (s.w + GRID.gap) + s.w) - l, t = top + row * (GRID.h + GRID.gap);
      var on = day === today, isDone = done.indexOf(day) >= 0;
      rrect(x, l + 0.5, t + 0.5, w - 1, GRID.h - 1, GRID.r);
      x.fillStyle = isDone ? 'rgba(134,214,173,.14)' : on ? '#1c1c22' : '#101013';
      x.fill();
      x.lineWidth = 1;
      x.strokeStyle = isDone ? 'rgba(134,214,173,.55)' : on ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.14)';
      x.stroke();
      x.font = (isDone ? '600 30px ' : '500 24px ') + MONO; x.fillStyle = isDone ? SIGNAL : on ? INK : SLATE;
      center(x, isDone ? '\u2713' : (day < 10 ? '0' : '') + day, t + GRID.h / 2 + 8.5, 0, l + w / 2);
    }
  }
  function stripLayout(x) {
    if (dayTotal() > 5) return gridLayout();
    var w = (W - PAD * 2 - STRIP.gap * 4) / 5;
    x.font = STRIP.font;
    var lines = moveList().map(function (m) { return wrap(x, m, w - 2 - STRIP.padX * 2 + 1, STRIP.ls, 3); });
    var n = Math.max.apply(null, lines.map(function (l) { return l.length; }));
    return { w: w, lines: lines, h: 2 + STRIP.padY * 2 + STRIP.row + 11.2 + n * STRIP.lh };
  }
  function drawStrip(x, s, top, today, done) {
    if (s.grid) return drawGrid(x, s, top, today, done);
    top = Math.round(top);
    for (var i = 0; i < 5; i++) {
      // Snap each card to whole pixels so its 1px border stays crisp.
      var day = i + 1, l = Math.round(PAD + i * (s.w + STRIP.gap)), w = Math.round(PAD + i * (s.w + STRIP.gap) + s.w) - l;
      var on = day === today, ct = top + 1 + STRIP.padY;
      rrect(x, l + 0.5, top + 0.5, w - 1, Math.round(s.h) - 1, STRIP.r);
      x.fillStyle = grad(x, top, top + s.h, on ? [[0, '#1f1f25'], [1, '#16161b']] : [[0, '#141418'], [1, '#0c0c0f']]);
      x.fill();
      x.lineWidth = 1;
      x.strokeStyle = grad(x, top, top + s.h * 0.35, on ? [[0, 'rgba(255,255,255,.62)'], [1, 'rgba(255,255,255,.4)']] : [[0, 'rgba(255,255,255,.26)'], [1, 'rgba(255,255,255,.08)']]);
      x.stroke();
      x.font = '400 19.04px ' + MONO; x.fillStyle = on ? INK : SLATE;
      x.fillText('DAY ' + day, l + 1 + STRIP.padX, ct + 19.1);
      if (done.indexOf(day) >= 0) {
        x.beginPath(); x.arc(l + w - 1 - STRIP.padX - 7.84, ct + STRIP.row / 2, 7.84, 0, Math.PI * 2);
        x.fillStyle = SIGNAL; x.fill();
      }
      x.font = STRIP.font; x.fillStyle = on ? INK : FOG;
      for (var j = 0; j < s.lines[i].length; j++) center(x, s.lines[i][j], ct + STRIP.row + 11.2 + j * STRIP.lh + 19.8, STRIP.ls, l + w / 2);
    }
  }

  function labelFor(day) {
    var L = window.C127CardLabels, v;
    if (L) v = Array.isArray(L) ? L[day === 'finisher' ? dayTotal() : day - 1] : L[day];
    return String(v || LABELS[day]).toUpperCase();
  }
  function dayKey(v) { return String(v) === 'finisher' ? 'finisher' : Math.min(dayTotal(), Math.max(1, parseInt(v, 10) || 1)); }

  function draw(opts) {
    opts = opts || {};
    var day = dayKey(opts.day), fin = day === 'finisher';
    var done = fin && !String(opts.done || '').length ? moveList().map(function (m, i) { return i + 1; }) : (Array.isArray(opts.done) ? opts.done : String(opts.done || '').split(',')).map(Number);
    var today = fin ? 0 : parseInt(opts.today, 10) || day;
    var name = String(opts.firstName || '').replace(/\s+/g, ' ').trim();
    var line = String(opts.line || '').replace(/\s+/g, ' ').trim();
    var url = String(opts.url || '127GROUP.IO/CHALLENGE').toUpperCase();
    return Promise.all([loadFonts(), loadImg('mark-white.svg'), fin ? loadImg('mark-chrome-3d.jpg') : null]).then(function (r) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      background(x);
      steelMark(x, r[1], 250);

      // Measure the centred column: hero, label + headline + sub, optional quote, five-day strip.
      var heroH = fin ? 303 : 208, max = W - PAD * 2;
      x.font = '700 100px ' + SANS;
      var head = name ? [[fit(x, name, max, -5), DIM], ['made today', STEEL], ['day one.', STEEL]] : [['Made today', DIM], ['day one.', STEEL]];
      x.font = '400 44px ' + SANS;
      // A site address (v2 Day 1) is shown as it is; any other line is a quote.
      var isLink = /^\S+\.[a-z]{2,}(\/\S*)?$/i.test(line);
      var quote = line ? balanced(x, isLink ? line : '\u201C' + line + '\u201D', max - 40, 3) : [];
      var strip = stripLayout(x);
      var block = 28.8 + 30 + head.length * 93 + 30 + 42, quoteH = quote.length ? 34 + quote.length * 57.2 : 0;
      var total = heroH + 52 + block + quoteH + 52 + strip.h;
      // Without a quote this reproduces the reference. With one: shrink the 3D mark, then rise, then push the pill down.
      var over = total - (1500 - 56 - 360);
      if (over > 0 && fin) { heroH -= Math.min(over, 83); total = heroH + total - 303; }
      var top = 360 + (1220 - total) / 2, pillY = 1500;
      if (top + total > pillY - 56) top = Math.max(340, pillY - 56 - total);
      pillY = Math.max(pillY, Math.round(top + total + 56));

      // Hero: steel day number, or the chrome 3D 127 for finishers (screen-blended so its black drops out).
      var img3d = r[2];
      if (fin && img3d) {
        var iw = heroH * img3d.naturalWidth / img3d.naturalHeight;
        // v2's plain void would show the photo's own near-black box under 'screen'; 'lighten' keeps the void.
        x.globalCompositeOperation = v2() ? 'lighten' : 'screen';
        x.drawImage(img3d, CX - iw / 2, top, iw, heroH);
        x.globalCompositeOperation = 'source-over';
      } else {
        var big = fin ? '127' : (day < 10 ? '0' : '') + day;
        x.font = fin ? '700 ' + Math.round(heroH * 0.76) + 'px ' + SANS : '600 260px ' + MONO;
        x.fillStyle = ink(x, top, top + heroH, STEEL);
        center(x, big, top + (fin ? heroH * 0.73 : 194), fin ? -heroH * 0.045 : -15.6);
      }

      var y = top + heroH + 52, ls = 6.72, size = 24;
      x.font = '500 24px ' + SANS;
      var label = labelFor(day);
      while (size > 16 && textW(x, label, ls) > max) { size -= 1; ls = size * 0.28; x.font = '500 ' + size + 'px ' + SANS; }
      x.fillStyle = FOG;
      center(x, fit(x, label, max, ls), y + 22.92, ls);

      y += 28.8 + 30;
      x.font = '700 100px ' + SANS;
      head.forEach(function (h, i) {
        var base = y + i * 93 + 81;
        x.fillStyle = ink(x, base - 100.5, base + 29.5, h[1]);
        center(x, h[0], base, -5);
      });
      y += head.length * 93 + 30;

      x.font = '400 30px ' + SANS; x.fillStyle = FOG;
      var friend = String(opts.friend || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      var sub = fin ? 'The Day One Challenge \u00b7 ' + (window.C127CardFinSub || (window.C127CardMoves ? '5 days, 5 things live' : '5 days, 5 moves')) : 'The Day One Challenge \u00b7 Day ' + day + ' of ' + dayTotal();
      if (friend) sub += ' \u00b7 with ' + friend;
      center(x, fit(x, sub, max, -0.15), y + 31.65, -0.15);
      y += 42;

      if (quote.length) {
        y += 34;
        x.font = '400 44px ' + SANS; x.fillStyle = '#c9cad3';
        quote.forEach(function (q, i) { center(x, q, y + i * 57.2 + 44.2, 0); });
        y += quote.length * 57.2;
      }

      drawStrip(x, strip, y + 53, today, done);

      // Pill with the URL.
      x.font = '500 24px ' + SANS;
      var pw = textW(x, url, 6) + 68, pl = Math.round(CX - pw / 2);
      rrect(x, pl + 0.5, pillY + 0.5, Math.round(pw) - 1, 64, 32);
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = INK;
      center(x, url, pillY + 41, 6);
      return c;
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Card export failed')); }, 'image/png');
    });
  }

  function isIOS() {
    return /iP(hone|od|ad)/.test(navigator.platform || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function mount(root) {
    if (!root || root.__c127card) return;
    root.__c127card = true;
    var d = root.dataset, key = dayKey(d.day);
    var preview = root.querySelector('[data-card-preview]'), toggle = root.querySelector('[data-card-line-toggle]');
    var opts = {
      day: key, firstName: d.firstName || '', line: d.line || '', url: d.url || undefined, friend: d.friend || '',
      done: (d.done || '').split(',').map(function (n) { return parseInt(n, 10); }).filter(Boolean),
      today: parseInt(d.today, 10) || (key === 'finisher' ? 0 : key)
    };
    var st = { seq: 0, canvas: null, blob: null, ready: null };
    var file = key === 'finisher' ? 'day-one-finisher.png' : 'day-one-day-' + key + '.png';

    function render() {
      var my = ++st.seq;
      st.blob = null;
      root.setAttribute('aria-busy', 'true');
      st.ready = draw(opts).then(function (c) {
        if (my !== st.seq) { c.width = c.height = 0; return st.ready; }
        c.style.cssText = 'display:block;width:100%;height:auto;box-sizing:border-box;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:' + BG;
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', 'Your Day One Challenge share card');
        if (preview) { preview.innerHTML = ''; preview.appendChild(c); }
        if (st.canvas) st.canvas.width = st.canvas.height = 0; // let iOS reclaim the old bitmap
        st.canvas = c;
        return toBlob(c).then(function (b) {
          if (my === st.seq) { st.blob = b; root.removeAttribute('aria-busy'); }
          return b;
        });
      });
      return st.ready;
    }

    function track(channel) {
      try { if (window.plausible) window.plausible('Challenge Share', { props: { day: String(key), channel: channel } }); } catch (e) { /* ignore */ }
    }
    function save(blob) {
      var href = URL.createObjectURL(blob);
      if (isIOS()) {
        if (!window.open(href, '_blank')) location.href = href;
      } else {
        var a = document.createElement('a');
        a.href = href; a.download = file; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(function () { URL.revokeObjectURL(href); }, 60000);
      track('save');
    }
    function share(blob) {
      var f = new File([blob], file, { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], text: d.shareText || SHARE_TEXT }).then(function () { track('share'); }, function (e) {
          if (!e || e.name !== 'AbortError') save(blob);
        });
      } else save(blob);
    }
    // Use the PNG made after drawing, so share() runs inside the tap (iOS needs the user gesture).
    function onTap(fn) {
      return function (e) {
        if (e) e.preventDefault();
        if (st.blob) fn(st.blob); else if (st.ready) st.ready.then(function (b) { if (b) fn(b); });
      };
    }
    var shareBtn = root.querySelector('[data-card-share]'), saveBtn = root.querySelector('[data-card-save]');
    if (shareBtn) shareBtn.addEventListener('click', onTap(share));
    if (saveBtn) saveBtn.addEventListener('click', onTap(save));
    if (toggle) {
      if (opts.line) toggle.checked = true; else if (toggle.checked) opts.line = d.lineOption || '';
      toggle.addEventListener('change', function () { opts.line = toggle.checked ? d.lineOption || '' : ''; render(); });
    }
    render();
  }

  window.C127Card = { draw: draw, toBlob: toBlob, mount: mount };
  function boot() {
    var els = document.querySelectorAll('[data-card]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
