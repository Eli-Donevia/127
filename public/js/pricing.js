// Membership page (/pricing). The page is complete without any of this.
// - the hero's frame covers the hero like object-fit: cover, so the page callouts stay on the printed pages
// - the room drifts a little with the pointer and slides slower than the page as you scroll away (not with reduced motion)
// - phones: tabs show one plan at a time and pick the compare column; they float under the thumb while the plans are on screen
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia ? matchMedia('(max-width: 760px)') : { matches: false, addEventListener: function () {} };

  var scene = document.querySelector('[data-scene]'), frame = scene && scene.querySelector('[data-frame]');
  if (scene && frame) {
    var fit = function () {
      var iw = +scene.getAttribute(phone.matches ? 'data-tw' : 'data-iw'), ih = +scene.getAttribute(phone.matches ? 'data-th' : 'data-ih');
      var W = scene.clientWidth, H = scene.clientHeight, s = Math.max(W / iw, H / ih), fw = iw * s, fh = ih * s;
      frame.style.width = fw + 'px'; frame.style.height = fh + 'px';
      frame.style.left = ((W - fw) * 0.5) + 'px'; frame.style.top = ((H - fh) * 0.6) + 'px';
      scene.classList.add('fit');
    };
    fit(); addEventListener('resize', fit);
    if (!reduce) {
      var tx = 0, ty = 0, gx = 0, gy = 0, sy = 0, raf = 0;
      var loop = function () {
        tx += (gx - tx) * 0.06; ty += (gy - ty) * 0.06;
        frame.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + (ty + sy).toFixed(2) + 'px,0) scale(1.04)';
        raf = Math.abs(gx - tx) + Math.abs(gy - ty) > 0.05 ? requestAnimationFrame(loop) : 0;
      };
      var kick = function () { if (!raf) raf = requestAnimationFrame(loop); };
      if (window.matchMedia && matchMedia('(hover: hover)').matches) {
        scene.parentNode.addEventListener('pointermove', function (e) {
          var r = scene.getBoundingClientRect();
          gx = -((e.clientX - r.left) / r.width - 0.5) * r.width * 0.025; gy = -((e.clientY - r.top) / r.height - 0.5) * r.height * 0.025; kick();
        }, { passive: true });
      }
      addEventListener('scroll', function () { var y = scrollY; if (y < scene.clientHeight * 1.2) { sy = y * 0.16; kick(); } }, { passive: true });
      frame.style.transform = 'scale(1.04)';
    }
  }

  var tabs = document.querySelector('[data-tabs]'), plans = document.querySelector('[data-plans]');
  var compare = document.querySelector('[data-compare]'), cname = document.querySelector('[data-compare-name]');
  var wrap = document.querySelector('[data-plans-wrap]');
  if (!tabs || !plans) return;
  var buttons = [].slice.call(tabs.querySelectorAll('[data-tab]'));
  var names = {};
  buttons.forEach(function (b) { names[b.getAttribute('data-tab')] = b.querySelector('span').textContent; });
  var pick = function (k, focus) {
    buttons.forEach(function (b) {
      var on = b.getAttribute('data-tab') === k;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    [].forEach.call(plans.querySelectorAll('[data-plan]'), function (p) { p.classList.toggle('on', p.getAttribute('data-plan') === k); });
    if (compare) compare.setAttribute('data-show', k);
    if (cname) cname.textContent = names[k];
  };
  var setup = function () {
    var on = phone.matches;
    tabs.hidden = !on;
    plans.classList.toggle('tabbed', on);
    if (compare) compare.classList.toggle('picked', on);
    [].forEach.call(plans.querySelectorAll('[data-plan]'), function (p) {
      if (on) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'tab-' + p.getAttribute('data-plan')); }
      else { p.removeAttribute('role'); p.removeAttribute('aria-labelledby'); }
    });
    if (!on) tabs.classList.remove('float');
  };
  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () {
      pick(b.getAttribute('data-tab'));
      // a tap on the floating tabs brings the chosen plan into view
      if (tabs.classList.contains('float')) { var t = plans.getBoundingClientRect().top + scrollY - 88; if (scrollY > t + 40 && scrollY < t + plans.offsetHeight) scrollTo({ top: t, behavior: reduce ? 'auto' : 'smooth' }); }
    });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); pick(buttons[(i + d + buttons.length) % buttons.length].getAttribute('data-tab'), true); }
    });
  });
  pick('builder'); setup();
  if (phone.addEventListener) phone.addEventListener('change', setup);

  // float the tabs at the bottom once their own spot has scrolled away, while the plans or the table are still on screen
  if (wrap && 'IntersectionObserver' in window) {
    var mark = document.createElement('div'); mark.style.height = '1px'; tabs.parentNode.insertBefore(mark, tabs);
    var aboveMark = false, inWrap = false;
    var update = function () {
      var f = phone.matches && aboveMark && inWrap;
      // keep the tabs' room in the page while they float, so nothing jumps
      if (f && !tabs.classList.contains('float')) mark.style.height = (tabs.offsetHeight + 21) + 'px';
      if (!f) mark.style.height = '1px';
      tabs.classList.toggle('float', f);
    };
    new IntersectionObserver(function (es) { es.forEach(function (e) { aboveMark = !e.isIntersecting && e.boundingClientRect.top < 0; }); update(); }).observe(mark);
    new IntersectionObserver(function (es) { es.forEach(function (e) { inWrap = e.isIntersecting; }); update(); }, { rootMargin: '0px 0px -120px 0px' }).observe(wrap);
  }
})();
