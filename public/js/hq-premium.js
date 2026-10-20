// The HQ premium pass (HQ_PREMIUM, public/css/hq-premium.css): the horizon light that leans toward the pointer on a
// spring, today's date in the member's own time zone, the headline's words rising in, the shelf counts ticking up, and
// the page's sections arriving in order on the first visit of a session. Every page reads complete without this file,
// and with reduced motion only the date is filled in.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var shell = $('.shell.hqp');
  if (!shell) return;

  var date = $('[data-today-date]');
  if (date) {
    try { date.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).replace(',', ' ·'); } catch (e) {}
  }

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return;

  // The first page of a session arrives; later pages are simply there.
  var first = true;
  try { first = !sessionStorage.getItem('hqp-in'); sessionStorage.setItem('hqp-in', '1'); } catch (e) {}
  if (first) {
    document.documentElement.classList.add('hqp-in');
    $$('.ws-link').forEach(function (a, i) { a.style.setProperty('--i', i); });
    $$('.h2-stack > *').forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 8)); });
    // Split the headline into words that rise one after another (text stays in the page as it was).
    $$('.hqp-head [data-split]').forEach(function (line, li) {
      var words = line.textContent.split(' '), n = li * 3;
      line.textContent = '';
      words.forEach(function (w, i) {
        var s = document.createElement('span');
        s.setAttribute('data-w', '');
        s.style.setProperty('--i', n + i);
        s.textContent = w;
        line.appendChild(s);
        if (i < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    // The shelf counts tick up from zero once.
    $$('.hqp-uses [data-count]').forEach(function (b, i) {
      var to = +b.getAttribute('data-count') || 0, t0 = 0, d = 1400, delay = 300 + i * 90;
      b.textContent = '0';
      var step = function (t) {
        if (!t0) t0 = t + delay;
        var k = Math.max(0, Math.min(1, (t - t0) / d));
        b.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    setTimeout(function () { document.documentElement.classList.remove('hqp-in'); }, 2600);
  }

  // The horizon: a spring toward the pointer. With no pointer it drifts for a few seconds after load, then rests
  // in the middle (nothing moves on its own for more than 5 seconds, WCAG 2.2.2), and it sleeps in a hidden tab.
  var hz = $('[data-hz]');
  if (!hz) return;
  var x = 0.5, v = 0, tx = 0.5, lastMove = 0, start = performance.now(), raf = 0, fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var tick = function (t) {
    raf = 0;
    if (document.hidden) return;
    var target = tx;
    if (!lastMove && t - start < 4500) target = 0.5 + 0.3 * Math.sin((t - start) / 900) * (1 - (t - start) / 4500);
    v += (target - x) * 0.05; v *= 0.84; x += v;
    hz.style.setProperty('--hx', (x * 100).toFixed(2) + '%');
    hz.style.setProperty('--hv', Math.min(0.4, Math.abs(v)).toFixed(3));
    if (Math.abs(v) > 0.0004 || Math.abs(target - x) > 0.001 || t - start < 4500) raf = requestAnimationFrame(tick);
  };
  var wake = function () { if (!raf) raf = requestAnimationFrame(tick); };
  if (fine) {
    window.addEventListener('pointermove', function (e) {
      var r = hz.getBoundingClientRect();
      if (!r.width) return;
      tx = Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width));
      lastMove = performance.now();
      wake();
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', wake);
  wake();
})();

// Connections: a folded group of apps opens when a search or filter finds something in it, and hides when it finds
// nothing (hq-apps.js does the finding).
(function () {
  var root = document.querySelector('.hqp-sb');
  if (!root) return;
  var search = root.querySelector('[data-ap-search]');
  var sync = function () {
    requestAnimationFrame(function () {
      var q = search && search.value.trim();
      Array.prototype.forEach.call(root.querySelectorAll('[data-held]'), function (d) {
        var cat = d.querySelector('[data-ap-cat]');
        d.hidden = !!(cat && cat.hidden);
        if (q && cat && !cat.hidden) d.open = true;
      });
    });
  };
  if (search) search.addEventListener('input', sync);
  Array.prototype.forEach.call(root.querySelectorAll('[data-ap-filter]'), function (b) { b.addEventListener('click', sync); });
})();

// The Map of everything (Workflows page): every workflow, prompt, template and app as one dot on a sunflower spiral
// around the member's Brain, each shelf its own ring. Point at a dot to see its name, click to open it; what the
// search box finds lights up. It grows out once when it comes into view, then holds still.
(function () {
  var fig = document.querySelector('.shell.hqp [data-map]');
  if (!fig || !window.fetch) return;
  var canvas = fig.querySelector('canvas'), tip = fig.querySelector('[data-map-tip]'), ctx = canvas.getContext('2d');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TONE = { workflows: 'rgba(236,238,245,.78)', prompts: 'rgba(236,238,245,.46)', store: 'rgba(160,166,184,.42)', connections: 'rgba(134,214,173,.55)' };
  var POP = '#7c8cff', GOLD = 2.39996323;
  var items = [], dots = [], hover = -1, lit = null, grow = still ? 1 : 0, W = 0, H = 0, dpr = 1;

  var layout = function () {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    var n = items.length, rx = W / 2 - 12, ry = H / 2 - 10;
    // A sunflower spiral stretched to the box; the first 40 turns stay empty so the Brain has room.
    dots = items.map(function (it, i) {
      var k = i + 40, a = k * GOLD, f = Math.sqrt(k / (n + 40));
      return { x: W / 2 + Math.cos(a) * f * rx, y: H / 2 + Math.sin(a) * f * ry, it: it, d: k / (n + 40) };
    });
    draw();
  };
  var draw = function () {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var g = still ? 1 : 1 - Math.pow(1 - grow, 3);
    dots.forEach(function (p, i) {
      var t = Math.max(0, Math.min(1, (g - p.d * 0.7) / 0.3));
      if (!t) return;
      var on = i === hover || (lit && lit[i]);
      ctx.beginPath();
      ctx.fillStyle = on ? POP : TONE[p.it[0]];
      ctx.arc(W / 2 + (p.x - W / 2) * t, H / 2 + (p.y - H / 2) * t, on ? 3.2 : 1.9, 0, 6.2832);
      ctx.fill();
    });
    // the Brain
    ctx.beginPath(); ctx.fillStyle = '#060607'; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
    ctx.arc(W / 2, H / 2, 17, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(236,238,245,.9)'; ctx.font = '600 11px Geist, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('127', W / 2, H / 2 + 0.5);
  };
  var nearest = function (e) {
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = -1, bd = 144;
    dots.forEach(function (p, i) { var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  var showTip = function () {
    if (hover < 0) { tip.textContent = ''; tip.classList.remove('on'); return; }
    var p = dots[hover];
    tip.textContent = p.it[1];
    tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px';
    tip.classList.add('on');
  };
  canvas.addEventListener('pointermove', function (e) { var h = nearest(e); if (h !== hover) { hover = h; canvas.style.cursor = h < 0 ? '' : 'pointer'; showTip(); draw(); } });
  canvas.addEventListener('pointerleave', function () { hover = -1; showTip(); draw(); });
  canvas.addEventListener('click', function (e) { var h = nearest(e); if (h >= 0) location.href = dots[h].it[2]; });

  var search = document.getElementById('wf-search');
  var light = function () {
    var q = search && search.value.trim().toLowerCase();
    lit = q && q.length > 1 ? items.map(function (it) { return it[1].toLowerCase().indexOf(q) !== -1; }) : null;
    draw();
  };
  if (search) search.addEventListener('input', light);

  fetch('/app/hq/map.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.items || !d.items.length) { fig.hidden = true; return; }
    items = d.items;
    fig.classList.add('ready');
    layout();
    if (search && search.value) light();
    window.addEventListener('resize', function () { layout(); });
    if (still) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = 0;
      var step = function (t) { if (!t0) t0 = t; grow = Math.min(1, (t - t0) / 1800); draw(); if (grow < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.3 });
    io.observe(fig);
  }).catch(function () { fig.hidden = true; });
})();

// Store: the curved gallery. Each card turns toward the middle of the row by how far it is from it, like a shelf
// that wraps around you; it only moves while the member scrolls it.
(function () {
  var track = document.querySelector('.shell.hqp [data-curve-track]');
  if (!track) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = Array.prototype.slice.call(track.children), raf = 0;
  var bend = function () {
    raf = 0;
    var r = track.getBoundingClientRect(), mid = r.left + r.width / 2;
    cards.forEach(function (c) {
      var b = c.getBoundingClientRect(), d = Math.max(-1.6, Math.min(1.6, (b.left + b.width / 2 - mid) / b.width));
      c.style.transform = 'rotateY(' + (-d * 22).toFixed(2) + 'deg) translateZ(' + (-Math.abs(d) * 60).toFixed(1) + 'px)';
      c.style.opacity = (1 - Math.min(0.45, Math.abs(d) * 0.22)).toFixed(2);
    });
  };
  var go = function () { if (!raf) raf = requestAnimationFrame(bend); };
  track.addEventListener('scroll', go, { passive: true });
  window.addEventListener('resize', go);
  // Start on the middle card so the curve reads both ways.
  var m = cards[Math.floor(cards.length / 2) - 1] || cards[0];
  track.scrollLeft = m.offsetLeft - (track.clientWidth - m.offsetWidth) / 2;
  bend();
})();

// Your Brain: the "127 knows" count and bar follow what's typed, before Save.
(function () {
  var bar = document.querySelector('.shell.hqp [data-brainbar]'), form = document.querySelector('.hqp-brain');
  if (!bar || !form) return;
  var total = +bar.getAttribute('data-total') || 1;
  var count = function () {
    var have = 0, by = {};
    Array.prototype.forEach.call(form.querySelectorAll('input[name], textarea[name]'), function (el) {
      var g = el.name.split('_')[0];
      if (el.name === 'goal_daily' || !/^(business|voice|links|goal)_/.test(el.name)) return;
      if (el.value.trim()) { have += 1; by[g] = (by[g] || 0) + 1; }
    });
    bar.querySelector('[data-have]').textContent = have;
    bar.querySelector('[data-bar]').style.width = Math.round(have / total * 100) + '%';
    Array.prototype.forEach.call(bar.querySelectorAll('[data-g]'), function (s) { s.textContent = (by[s.getAttribute('data-g')] || 0) + s.textContent.replace(/^\d+/, ''); });
  };
  form.addEventListener('input', count);
})();

// Read my week: ask for the "What stood out" line now that the member has the page open. It may come back empty
// (no clear pattern, AI off, or the line didn't pass the server's check), and then the card stays hidden.
(function () {
  var card = document.querySelector('.shell.hqp [data-week-line]');
  if (!card || !window.fetch) return;
  fetch('/app/hq/week/line.json', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.line) return;
    card.querySelector('[data-week-text]').textContent = d.line;
    card.hidden = false;
  }).catch(function () {});
})();
