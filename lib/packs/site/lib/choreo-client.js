// Browser code (plain ES2015, no build step): the choreography runtime that lib/motion.js inlines at the end of the
// body of a design that declares `choreo`. It reads one settings block (see lib/choreo.md), waits for the vendored
// Motion bundle (vendor/motion-sites.js, loaded with defer) and drives the intro, the motion at rest and the scroll
// moment from the page's data-ci / data-alive / data-sc hooks. Comment lines (starting with //) are stripped when
// inlined, so keep comments on their own lines.
(function (C) {
  var d = document, h = d.documentElement;
  // Reduced motion never gets class "m" (lib/motion.js), so nothing was hidden and nothing runs.
  if (!h.classList.contains('m')) return;
  var q = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  var done = function () { h.classList.add('ci-go'); };
  var started = false;
  function boot() {
    if (started) return;
    started = true;
    var M = window.Motion;
    if (!M) return done();
    try { run(M); } catch (e) { done(); }
  }
  // The bundle is deferred: it has run by DOMContentLoaded.
  if (window.Motion) boot(); else d.addEventListener('DOMContentLoaded', boot);
  addEventListener('load', boot);

  function run(M) {
    var K = C.k || 1;
    var small = innerWidth < 760 || !matchMedia('(hover: hover)').matches;
    var save = navigator.connection && navigator.connection.saveData;
    var seed = 9;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var cl = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var EO = [0.16, 1, 0.3, 1], IO = [0.7, 0, 0.2, 1];
    // One spring for the whole page: firm, settling just past the mark at most (never a rubber bounce).
    var SPR = 0.1;
    var A = function (el, kf, o) {
      o.duration = (o.duration || 1) * K;
      o.delay = (o.delay || 0) * K;
      if (o.bounce !== undefined) o.type = M.spring;
      // Hold the first frame until the delay is over, so nothing shows early.
      var p;
      for (p in kf) el.style[p] = kf[p][0];
      var play = function () {
        var an = M.animate(el, kf, o);
        // Keep the last frame once it has played (the first frame was set inline above); a finished filter or clip-path
        // is cleared so it does not keep a layer alive.
        an.then(function () { for (p in kf) el.style[p] = p === 'filter' || p === 'clipPath' ? '' : kf[p][kf[p].length - 1]; });
        // The pop: the piece lands in the member's colour and cools to its own, so the colour trails across the line.
        if (o.pop && POP && trail) { var base = getComputedStyle(el).color; M.animate(el, { color: [POP, POP, base] }, { duration: 1.5 * K, delay: o.delay, ease: 'ease-in' }).then(function () { el.style.color = ''; }); }
      };
      // Below the fold on arrival: it plays when it comes into view instead, so the idea is seen.
      if (el.getBoundingClientRect().top > innerHeight * 0.92) { o.delay = 0.05; M.inView(el, function () { play(); }, { amount: 0.2 }); } else play();
    };
    // The member's own colour (--pop, from their brand colour), used as light on the subject: never a fill or a glow.
    var POP = (getComputedStyle(h).getPropertyValue('--pop') || '').trim();
    var paused = function () { return h.classList.contains('mp') || d.hidden; };

    // ---- intro -------------------------------------------------------------------------------------------------
    // The head's pieces: [data-ci-part] children if the design split it already, else its words (and letters).
    function pieces(el, letters) {
      var own = q('[data-ci-part]', el);
      if (own.length) return own;
      var text = el.textContent.replace(/\s+/g, ' ').trim();
      var sr = d.createElement('span'), vis = d.createElement('span'), out = [];
      sr.className = 'sr-only';
      sr.textContent = text;
      vis.setAttribute('aria-hidden', 'true');
      while (el.firstChild) vis.appendChild(el.firstChild);
      (function walk(n) {
        [].slice.call(n.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var f = d.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach(function (t) {
              if (!t) return;
              if (/^\s+$/.test(t)) return f.appendChild(d.createTextNode(' '));
              var w = d.createElement('span');
              w.className = 'ci-w';
              if (letters) Array.from(t).forEach(function (ch) { var s = d.createElement('span'); s.className = 'ci-c'; s.textContent = ch; w.appendChild(s); out.push(s); });
              else { w.textContent = t; out.push(w); }
              f.appendChild(w);
            });
            n.replaceChild(f, c);
          } else if (c.nodeType === 1 && !/^(BR|SVG)$/i.test(c.tagName)) walk(c);
        });
      })(vis);
      el.appendChild(sr);
      el.appendChild(vis);
      return out;
    }
    var radius = function (el) { var r = getComputedStyle(el).borderTopLeftRadius; return r && r !== '0px' ? ' round ' + r : ''; };
    // A head blended into its own light (lumen) keeps its colour: its light is already the pop.
    var popOk = true, trail = false, gesture = '';
    var HEAD = {
      assemble: function (ps) {
        var n = ps.length;
        ps.forEach(function (p, i) {
          var x = ((rnd() - 0.5) * 1.6).toFixed(2), y = ((rnd() - 0.5) * 1.3).toFixed(2), r = ((rnd() - 0.5) * 60).toFixed(0);
          A(p, { transform: ['translate(' + x + 'em,' + y + 'em) rotate(' + r + 'deg) scale(.5)', 'none'], opacity: [0, 1] }, { duration: 0.95, bounce: SPR, delay: 0.05 + (i / Math.max(n, 1)) * 0.6, pop: popOk });
        });
        return 0.8;
      },
      develop: function (ps) {
        ps.forEach(function (p, i) {
          A(p, small ? { opacity: [0, 1], transform: ['translateY(.18em)', 'none'] } : { opacity: [0, 1], filter: ['blur(14px)', 'blur(0px)'], transform: ['translateY(.12em) scale(1.04)', 'none'] }, { duration: 1.3, ease: EO, delay: 0.15 + i * 0.075, pop: popOk });
        });
        return 0.6;
      },
      pour: function (ps) {
        var n = ps.length;
        ps.forEach(function (p, i) {
          A(p, { transform: ['translateY(-1.1em) scaleY(1.35)', 'none'], opacity: [0, 1] }, { duration: 0.85, bounce: SPR, delay: 0.1 + (i / Math.max(n, 1)) * 0.7, pop: popOk });
        });
        return 0.7;
      },
      unfold: function (ps) {
        ps.forEach(function (p, i) {
          p.style.transformOrigin = '50% 100%';
          A(p, { transform: ['perspective(600px) rotateX(-95deg)', 'perspective(600px) rotateX(0deg)'], opacity: [0, 1] }, { duration: 1.15, bounce: SPR, delay: 0.1 + i * 0.085, pop: popOk });
        });
        return 0.65;
      },
      // mask: the words rise out of their own baseline, as if from behind a rule.
      mask: function (ps) {
        ps.forEach(function (p, i) {
          A(p, { clipPath: ['inset(0% -10% 100% -10%)', 'inset(-20% -10% -20% -10%)'], transform: ['translateY(.55em)', 'none'] }, { duration: 1, ease: EO, delay: 0.1 + i * 0.06, pop: popOk });
        });
        return 0.5;
      },
      // stamp: each word is pressed onto the page, a beat apart, like type in a press.
      stamp: function (ps) {
        ps.forEach(function (p, i) {
          A(p, { opacity: [0, 1], transform: ['scale(1.32)', 'none'] }, { duration: 0.42, ease: [0.2, 0, 0, 1], delay: 0.15 + i * 0.11, pop: popOk });
        });
        return 0.25 + ps.length * 0.11;
      },
      // draw: the words settle from wide tracking while the subject's lines draw themselves.
      draw: function (ps) {
        ps.forEach(function (p, i) {
          A(p, { opacity: [0, 1], letterSpacing: ['.12em', '0em'] }, { duration: 1.2, ease: EO, delay: 0.2 + i * 0.07, pop: popOk });
        });
        return 0.7;
      },
      type: function (ps, el) {
        var n = ps.length, step = Math.min(0.05, 1.3 / Math.max(n, 1)) * K, at = null;
        el.classList.add('ci-typing');
        ps.forEach(function (p, i) {
          p.style.opacity = 0;
          setTimeout(function () { p.style.opacity = ''; if (at) at.classList.remove('ci-at'); at = p; p.classList.add('ci-at'); }, (0.2 + i * step) * 1000);
        });
        setTimeout(function () { el.classList.remove('ci-typing'); if (at) at.classList.remove('ci-at'); }, (0.2 + n * step + 1.1 * K) * 1000);
        return 0.2 + n * step * 0.7;
      },
    };
    var SUBJECT = {
      assemble: function (el) { A(el, { transform: ['translateY(48px) scale(.9) rotate(-2deg)', 'none'], opacity: [0, 1] }, { duration: 1.1, bounce: SPR, delay: 0.3 }); },
      develop: function (el) {
        A(el, { opacity: [0, 1], filter: [small ? 'saturate(0) brightness(1.5)' : 'blur(18px) saturate(0) brightness(1.5)', small ? 'saturate(1) brightness(1)' : 'blur(0px) saturate(1) brightness(1)'], transform: ['scale(1.05)', 'none'] }, { duration: 2, ease: EO, delay: 0.05 });
      },
      pour: function (el) { var r = radius(el); el.style.opacity = 1; A(el, { clipPath: ['inset(100% 0% 0% 0%' + r + ')', 'inset(0% 0% 0% 0%' + r + ')'] }, { duration: 1.5, ease: IO, delay: 0.25 }); },
      unfold: function (el) { var r = radius(el); el.style.opacity = 1; A(el, { clipPath: ['inset(0% 50% 0% 50%' + r + ')', 'inset(0% 0% 0% 0%' + r + ')'], transform: ['scale(1.06)', 'none'] }, { duration: 1.5, ease: IO, delay: 0.2 }); },
      mask: function (el) { var r = radius(el); el.style.opacity = 1; A(el, { clipPath: ['inset(100% 0% 0% 0%' + r + ')', 'inset(0% 0% 0% 0%' + r + ')'], transform: ['scale(1.08)', 'none'] }, { duration: 1.4, ease: IO, delay: 0.15 }); },
      stamp: function (el) { A(el, { opacity: [0, 1], transform: ['scale(1.05)', 'none'], filter: ['contrast(1.5) brightness(1.15)', 'contrast(1) brightness(1)'] }, { duration: 0.6, ease: [0.2, 0, 0, 1], delay: 0.1 }); },
      // The subject's own line work ([pathLength="1"] paths, or every path, line, circle and rect of its SVG) draws on.
      draw: function (el) {
        el.style.opacity = 1;
        var ls = q('[pathLength="1"]', el);
        if (!ls.length) ls = q('svg path, svg line, svg circle, svg rect, svg polyline', el).filter(function (x) { return typeof x.getTotalLength === 'function'; });
        if (!ls.length) return A(el, { opacity: [0, 1] }, { duration: 1, ease: EO, delay: 0.1 });
        ls.forEach(function (x, i) {
          var L = x.getAttribute('pathLength') === '1' ? 1 : x.getTotalLength();
          x.style.strokeDasharray = L + ' ' + L;
          A(x, { strokeDashoffset: [L, 0] }, { duration: 1.6, ease: IO, delay: 0.1 + (i / ls.length) * 0.8 });
        });
      },
      type: function (el) { var r = radius(el); el.style.opacity = 1; A(el, { clipPath: ['inset(0% 100% 0% 0%' + r + ')', 'inset(0% 0% 0% 0%' + r + ')'] }, { duration: 1.3, ease: IO, delay: 0.45 }); },
    };
    var intro = save ? 'none' : C.intro;
    var heads = q('[data-ci=head]'), subs = q('[data-ci=subject]'), thens = q('[data-ci=then]');
    var lead = 0;
    if (HEAD[intro]) {
      var letters = !small && (intro === 'assemble' || intro === 'pour');
      heads.forEach(function (el) {
        el.style.opacity = 1;
        popOk = !!POP && getComputedStyle(el).mixBlendMode === 'normal';
        // The design picks its own pop gesture on the head: data-pop="line" (a line drawn under the last word),
        // "trail" (the letters land in the member's colour and cool), both, or none (the default).
        gesture = el.getAttribute('data-pop') || '';
        trail = /trail/.test(gesture);
        var ps = pieces(el, letters || intro === 'type');
        var end = HEAD[intro](ps, el);
        lead = Math.max(lead, end);
        // One pop per view: the head's last word gets a line in the member's colour, drawn in once the words have landed.
        var last = ps.length && (ps[ps.length - 1].closest('.ci-w') || ps[ps.length - 1].parentNode);
        if (popOk && /line/.test(gesture) && last && last !== el) { last.classList.add('ci-pop'); setTimeout(function () { last.classList.add('ci-pop-on'); }, (end + 0.5) * K * 1000); }
      });
      subs.forEach(function (el) { SUBJECT[intro](el); });
      // What follows arrives the design's way (data-ci-from): rise (default; --ci-rise sets how far), mask (wipes up
      // from its baseline), fade, or side (slides in from the left).
      thens.forEach(function (el, i) {
        var from = el.getAttribute('data-ci-from') || 'rise', rise = (getComputedStyle(el).getPropertyValue('--ci-rise') || '').trim() || '18px';
        var kf = from === 'mask' ? { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'], transform: ['translateY(.4em)', 'none'] }
          : from === 'fade' ? { opacity: [0, 1] }
          : from === 'side' ? { opacity: [0, 1], transform: ['translateX(-' + rise + ')', 'none'] }
          : { opacity: [0, 1], transform: ['translateY(' + rise + ')', 'none'] };
        if (from === 'mask') el.style.opacity = 1;
        A(el, kf, { duration: from === 'fade' ? 0.7 : 0.9, ease: EO, delay: lead + i * 0.08 });
      });
    }
    done();
    var introEnd = HEAD[intro] ? (lead + thens.length * 0.08 + 1.2) * K * 1000 : 0;

    // ---- scroll moment ------------------------------------------------------------------------------------------
    var kind = C.scroll;
    q('[data-sc]').forEach(function (sec) {
      if (kind === 'none' || kind === 'roadmap') return;
      var parts = q('[data-sc-part]', sec), n = parts.length || 1;
      sec.style.setProperty('--n', n);
      var pin = kind === 'pin' && !small && matchMedia('(min-width: 48rem)').matches;
      // A section with a stage (a box that sticks) is measured while it is stuck; otherwise as it crosses the screen.
      var staged = pin || (!!sec.querySelector('[data-sc-stage]') && kind !== 'pin');
      var off = staged ? ['start start', 'end end'] : kind === 'scene' ? ['start end', 'end start'] : ['start end', 'center center'];
      M.scroll(function (p) {
        sec.style.setProperty('--p', p.toFixed(4));
        var cur = pin ? Math.min(n - 1, Math.floor(p * n)) : -1;
        parts.forEach(function (el, i) {
          var li = pin ? cl(p * n - i, 0, 1) : kind === 'scene' ? p : cl((p - (i / n) * 0.45) / 0.55, 0, 1);
          el.style.setProperty('--pi', li.toFixed(4));
          el.classList.toggle('on', pin ? i <= cur : li > 0.5);
          if (pin) el.classList.toggle('cur', i === cur);
        });
        if (kind === 'scene') sec.classList.toggle('sc-in', p > 0.25 && p < 0.8);
      }, { target: sec, offset: off });
    });
    // Roadmaps (data-rm, lib/templates/roadmap.js): the line draws with the scroll and each node pops in as the line
    // reaches it, in order, and back when scrolling up. Every design's roadmap plays unless scroll is "none".
    var rms = q('[data-rm]');
    if (rms.length && kind !== 'none') {
      h.classList.add('rm-go');
      rms.forEach(function (sec) {
        var ns = q('.rm-node', sec), n = ns.length, rm = sec.querySelector('.rm') || sec;
        // The comet: a dot in the member's colour riding the tip of the line, with a short trail that catches up on
        // springs. It only moves while the page scrolls.
        var cm = d.createElement('span'), dots = [], tp = [0, 0], pp = 0, craf = 0;
        cm.className = 'rm-comet';
        cm.setAttribute('aria-hidden', 'true');
        for (var j = 0; j < 4; j++) { var dt = d.createElement('i'); cm.appendChild(dt); dots.push({ el: dt, x: 0, y: 0, f: [1, 0.34, 0.2, 0.12][j], s: [1, 0.72, 0.5, 0.32][j] }); }
        rm.appendChild(cm);
        var pts = null, pw = 0, line = sec.querySelector('.rm-line'), wv = sec.querySelector('.rm-wave'), ol = sec.querySelector('.rm-nodes');
        var tip = function (p) {
          var R = rm.getBoundingClientRect();
          if (wv && getComputedStyle(wv).display !== 'none' && line) {
            var W = wv.getBoundingClientRect();
            // The line's dash is measured on screen (non-scaling stroke), so walk the path in screen pixels.
            if (!pts || pw !== W.width) {
              pw = W.width; pts = [];
              var L = line.getTotalLength(), acc = 0, px0 = 0, py0 = 0;
              for (var u = 0; u <= 120; u++) { var pt = line.getPointAtLength((u / 120) * L), sx = (pt.x / 1000) * W.width, sy = (pt.y / 100) * W.height; if (u) acc += Math.hypot(sx - px0, sy - py0); pts.push([sx, sy, acc]); px0 = sx; py0 = sy; }
            }
            var goal = p * pts[pts.length - 1][2], z = 1;
            while (z < pts.length - 1 && pts[z][2] < goal) z++;
            var A0 = pts[z - 1], B0 = pts[z], f = B0[2] > A0[2] ? (goal - A0[2]) / (B0[2] - A0[2]) : 0;
            return [W.left - R.left + A0[0] + (B0[0] - A0[0]) * f, W.top - R.top + A0[1] + (B0[1] - A0[1]) * f];
          }
          var O = ol.getBoundingClientRect(), rem = parseFloat(getComputedStyle(h).fontSize) || 16;
          return [O.left - R.left + 1.35 * rem + 1.5, O.top - R.top + 1.4 * rem + p * (O.height - 2.8 * rem)];
        };
        var cstep = function () {
          craf = 0;
          var moving = false;
          dots.forEach(function (o, k) {
            var fx = k ? dots[k - 1].x : tp[0], fy = k ? dots[k - 1].y : tp[1];
            o.x += (fx - o.x) * (k ? o.f * 1.6 : 1);
            o.y += (fy - o.y) * (k ? o.f * 1.6 : 1);
            if (Math.abs(fx - o.x) + Math.abs(fy - o.y) > 0.4) moving = true;
            o.el.style.transform = 'translate3d(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px,0) scale(' + o.s + ')';
          });
          if (moving && !d.hidden) craf = requestAnimationFrame(cstep);
        };
        M.scroll(function (p) {
          sec.style.setProperty('--p', p.toFixed(4));
          var cur = -1;
          ns.forEach(function (el, i) { var on = p >= (n < 2 ? 0 : (i / (n - 1)) * 0.97); el.classList.toggle('on', on); if (on) cur = i; });
          ns.forEach(function (el, i) { el.classList.toggle('cur', i === cur); });
          cm.classList.toggle('lit', p > 0.004 && p < 0.985);
          tp = tip(p);
          if (Math.abs(p - pp) > 0.2) dots.forEach(function (o) { o.x = tp[0]; o.y = tp[1]; });
          pp = p;
          if (!craf) craf = requestAnimationFrame(cstep);
        }, { target: rm, offset: ['start 0.85', 'end 0.75'] });
      });
    }
    // Buttons press in and spring back, barely past where they started (no rubber bounce).
    q('main .btn').forEach(function (b) {
      b.addEventListener('pointerdown', function () { M.animate(b, { scale: 0.94 }, { type: M.spring, duration: 0.25, bounce: 0 }); });
      var up = function () { M.animate(b, { scale: 1 }, { type: M.spring, duration: 0.6, bounce: SPR }); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
    });
    // Bands that move with the page (data-sx="0.3": that share of the scroll, sideways, wrapping round).
    var bands = q('[data-sx]');
    if (bands.length) M.scroll(function (p, info) {
      var y = info && info.y ? info.y.current : scrollY;
      bands.forEach(function (b) { var w = b.scrollWidth / 2 || 1, k = parseFloat(b.getAttribute('data-sx')) || 0.25, x = (y * k) % w; b.style.transform = 'translate3d(' + (k > 0 ? -x : -w - x).toFixed(1) + 'px,0,0)'; });
    });

    // ---- alive at rest: springs, not loops ------------------------------------------------------------------------
    var AL = C.alive || [];
    if (AL.indexOf('still') > -1 || save) return;
    var has = function (x) { return AL.indexOf(x) > -1; };
    var B = q('[data-alive]').map(function (el) { return { el: el, k: parseFloat(el.getAttribute('data-alive')) || 1, p: [0, 0, 0, 0, 0], v: [0, 0, 0, 0, 0], dr: [0, 0, 0, 0, 0], next: 0, vis: true }; });
    if (!B.length) return;
    var px = 0, py = 0, pon = 0, sv = 0, lastY = scrollY, raf = 0, last = 0;
    var lean = has('pointer') && !small;
    if (lean) {
      addEventListener('pointermove', function (e) { px = e.clientX / innerWidth * 2 - 1; py = e.clientY / innerHeight * 2 - 1; pon = 1; go(); }, { passive: true });
      d.addEventListener('pointerleave', function () { pon = 0; });
    }
    if (has('scroll')) addEventListener('scroll', function () { sv += scrollY - lastY; lastY = scrollY; go(); }, { passive: true });
    if (has('tap')) B.forEach(function (b) {
      b.el.addEventListener('pointerdown', function () { b.v[4] -= 1.3 * b.k; b.v[3] += (rnd() > 0.5 ? 1 : -1) * 100 * b.k; b.v[2] += 40 * b.k; go(); });
    });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { B.forEach(function (b) { if (b.el === e.target) b.vis = e.isIntersecting; }); }); go(); });
    B.forEach(function (b) { io.observe(b.el); });
    var stiff = 42 / (K * K), damp = 5.8 / K;
    function frame(now) {
      raf = 0;
      if (paused()) return;
      var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016), any = false;
      last = now;
      sv *= 0.86;
      var svc = cl(sv, -60, 60);
      B.forEach(function (b) {
        if (!b.vis) return;
        any = true;
        var k = b.k;
        if (has('drift') && now > b.next) {
          b.next = now + (2600 + rnd() * 2200) * K;
          b.dr = [(rnd() - 0.5) * 16 * k, (rnd() - 0.5) * 13 * k, (rnd() - 0.5) * 3.2 * k, (rnd() - 0.5) * 3.2 * k, (rnd() - 0.5) * 0.016 * k];
        }
        var t = b.dr.slice();
        if (lean && pon) { t[0] += px * 11 * k; t[1] += py * 8 * k; t[2] += -py * 6.5 * k; t[3] += px * 9 * k; }
        if (has('scroll')) { t[1] += -svc * 0.5 * k; t[2] += svc * 0.18 * k; }
        for (var i = 0; i < 5; i++) {
          var s = i === 4 ? stiff * 4 : i < 2 && !lean && !has('scroll') ? stiff * 0.35 : stiff;
          b.v[i] += ((t[i] - b.p[i]) * s - b.v[i] * (i === 4 ? damp * 1.4 : damp)) * dt;
          b.p[i] += b.v[i] * dt;
        }
        b.el.style.transform = 'perspective(1000px) translate3d(' + b.p[0].toFixed(2) + 'px,' + b.p[1].toFixed(2) + 'px,0) rotateX(' + b.p[2].toFixed(3) + 'deg) rotateY(' + b.p[3].toFixed(3) + 'deg) scale(' + (1 + b.p[4]).toFixed(4) + ')';
      });
      if (any) go();
    }
    function go() { if (!raf && !paused() && aliveOn) { last = 0; raf = requestAnimationFrame(frame); } }
    var aliveOn = false;
    d.addEventListener('visibilitychange', go);
    new MutationObserver(go).observe(h, { attributes: true, attributeFilter: ['class'] });
    // At rest only after the page has loaded and the intro has played.
    var wake = function () { setTimeout(function () { aliveOn = true; go(); }, Math.max(0, introEnd - 400)); };
    if (d.readyState === 'complete') wake(); else addEventListener('load', wake);
  }
})(CHOREO);
