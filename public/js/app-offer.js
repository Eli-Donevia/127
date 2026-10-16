// In-app founding offer: the founding bar (hide for today, phone strip, countdown line),
// the closed-offer notice, and Plausible events (no personal data; no ad pixels in /app).
(function () {
  function track(name, props) {
    if (window.plausible) window.plausible(name, { props: props });
  }
  function setCookie(name) {
    document.cookie = name + '=1; max-age=86400; path=/; samesite=lax';
  }

  // "Upgrade Click" on every upgrade button: placement + price.
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('form[data-upgrade]');
    if (f) track('Upgrade Click', { placement: f.getAttribute('data-upgrade'), price: Number(f.getAttribute('data-price')) || null });
  }, true);

  var closed = document.querySelector('[data-fb-closed]');
  if (closed) {
    closed.querySelector('button').addEventListener('click', function () {
      setCookie('fbclosed');
      closed.remove();
    });
  }

  // Day 7 / Day 14 upgrade screen: three steps, swipeable on phones, closable at any step.
  var ups = document.querySelector('.ups');
  if (ups) {
    var track_ = ups.querySelector('.ups-track');
    var steps = ups.querySelectorAll('.ups-step');
    var dots = ups.querySelectorAll('.ups-dots span');
    var day = Number(ups.getAttribute('data-day'));
    var seen = {};
    var current = function () { return Math.round(track_.scrollLeft / Math.max(1, track_.clientWidth)); };
    var onStep = function () {
      var i = current();
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
      if (!seen[i]) { seen[i] = true; track('Upgrade Screen View', { day: day, step: i + 1 }); }
    };
    track_.addEventListener('scroll', function () { clearTimeout(track_._t); track_._t = setTimeout(onStep, 80); });
    ups.querySelectorAll('[data-ups-next]').forEach(function (b) {
      b.addEventListener('click', function () { track_.scrollTo({ left: (current() + 1) * track_.clientWidth, behavior: 'smooth' }); });
    });
    var close = function () { ups.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    ups.querySelectorAll('[data-ups-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', esc);
    onStep();
    if (steps[0]) steps[0].querySelector('button').focus();
  }

  var fb = document.querySelector('.fb');
  if (!fb) return;

  // "Founding Bar View" once per session.
  try {
    if (!sessionStorage.getItem('fbv')) {
      sessionStorage.setItem('fbv', '1');
      track('Founding Bar View', { variant: fb.getAttribute('data-variant') });
    }
  } catch (err) { /* storage blocked: skip the event */ }

  var hide = fb.querySelector('[data-fb-hide]');
  if (hide) {
    hide.addEventListener('click', function () {
      setCookie('fbhide');
      fb.classList.add('is-hidden');
    });
  }

  // Strip text: "Founding price ends in 2d 04h".
  var target = Number(fb.getAttribute('data-target'));
  var leftEl = fb.querySelector('[data-fb-left]');
  function tick() {
    if (!target || !leftEl) return;
    var l = Math.max(0, target - Date.now());
    leftEl.textContent = 'Founding price ends in ' + Math.floor(l / 864e5) + 'd ' + String(Math.floor(l / 36e5) % 24).padStart(2, '0') + 'h';
  }
  tick();
  setInterval(tick, 60000);

  // On phones the bar becomes a slim line under the header once it scrolls away.
  var bar = fb.querySelector('.founding-bar');
  if (bar && 'IntersectionObserver' in window) {
    var phone = window.matchMedia('(max-width: 760px)');
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      var floating = phone.matches && !e.isIntersecting && e.boundingClientRect.top < 0;
      var head = document.querySelector('.mobile-top');
      var strip = fb.querySelector('.fb-strip');
      if (strip) strip.style.top = floating && head ? head.offsetHeight + 'px' : '';
      fb.classList.toggle('is-floating', floating);
    }).observe(bar);
  }
})();
