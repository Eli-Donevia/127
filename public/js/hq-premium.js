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
