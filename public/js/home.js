// Homepage motion: reveals, scroll-lit lines, the sticky product story and count-ups.
// Everything degrades to a static page without JS or with reduced motion.
(function () {
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // Reveal on scroll
  var reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !still) {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (el) { ro.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  // Count-ups
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-to')), pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    if (still) { el.textContent = pre + to + suf; return; }
    var t0 = null, dur = 1400;
    function step(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = pre + v + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-to]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  } else counters.forEach(countUp);

  // Scroll-lit lines and the sticky story
  var lines = [].slice.call(document.querySelectorAll('.lit'));
  var steps = [].slice.call(document.querySelectorAll('.story-step'));
  var screens = [].slice.call(document.querySelectorAll('.story-screen'));
  var device = document.querySelector('.device');
  var story = document.querySelector('.story-wrap');
  var active = -1;
  function onScroll() {
    var vh = window.innerHeight;
    lines.forEach(function (l) {
      var r = l.getBoundingClientRect(), c = r.top + r.height / 2;
      var d = Math.abs(c - vh * 0.5) / (vh * 0.5);
      // from the dim color (#66666e, 3.5:1 on the page) to full ink (#ededf2); a gradient word only fades a little
      var k = still ? 1 : Math.max(0, Math.min(1, 1 - d * 1.1));
      l.style.color = 'rgb(' + [102 + 135 * k, 102 + 135 * k, 110 + 132 * k].map(Math.round).join(',') + ')';
      [].forEach.call(l.querySelectorAll('span'), function (s) { s.style.opacity = (0.5 + 0.5 * k).toFixed(3); });
    });
    if (steps.length) {
      var idx = 0;
      steps.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.55) idx = i; });
      if (idx !== active) {
        active = idx;
        steps.forEach(function (s, i) { s.classList.toggle('on', i === idx); });
        screens.forEach(function (s, i) { s.classList.toggle('on', i === idx); });
      }
      if (device && story && !still) {
        var r = story.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
        device.style.transform = 'perspective(1600px) rotateX(' + (14 - p * 14).toFixed(2) + 'deg) rotateY(' + (-16 + p * 16).toFixed(2) + 'deg) rotateZ(' + (2 - p * 2).toFixed(2) + 'deg)';
      }
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Tilt-on-hover for the collage cards
  if (!still && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  // Videos play inline when someone taps the poster. The walkthrough has no <video> until then (it's silent, so it
  // stays muted), and phones get the 9:16 cut.
  document.querySelectorAll('.video-frame').forEach(function (frame) {
    var btn = frame.querySelector('.video-play');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var v = frame.querySelector('video');
      if (!v && frame.dataset.srcWide) {
        var tall = window.matchMedia && matchMedia('(max-width: 760px)').matches;
        v = document.createElement('video');
        var base = (tall ? frame.dataset.srcTall : frame.dataset.srcWide).replace(/\.mp4$/, '');
        v.innerHTML = '<source src="' + base + '.webm" type="video/webm"><source src="' + base + '.mp4" type="video/mp4">';
        v.muted = true; v.playsInline = true; v.setAttribute('playsinline', '');
        var pic = frame.querySelector('picture img');
        if (pic) v.poster = pic.currentSrc || pic.src;
        frame.classList.add('is-playing');
        frame.appendChild(v);
      }
      if (!v) return;
      v.controls = true;
      if (!frame.dataset.srcWide) v.muted = false;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      btn.hidden = true;
    });
  });
})();
