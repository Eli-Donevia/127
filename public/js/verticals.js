// Verticals page (views/verticals/page.ejs). Two things, both off under reduced motion where it matters:
//   the scroll moment: the sample site scrolls inside the phone while the hero passes, and back again on the way up
//   the sticky free start on phones, once the hero's own button has scrolled away
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = document.querySelector('[data-phone]');
  var img = phone && phone.querySelector('[data-scroller]');
  if (phone && img && !reduce) {
    var screen = img.parentNode, ticking = false, on = false;
    var update = function () {
      ticking = false;
      var r = phone.getBoundingClientRect(), vh = window.innerHeight;
      // 0 while the phone's top is low in the view, 1 once it has risen to the top of the screen.
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.85 + r.height * 0.35)));
      var travel = Math.max(0, img.offsetHeight - screen.clientHeight);
      img.style.setProperty('--vt-scroll', (-p * travel).toFixed(1) + 'px');
    };
    var ask = function () { if (on && !ticking) { ticking = true; requestAnimationFrame(update); } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { on = e[0].isIntersecting; ask(); }).observe(phone);
    } else on = true;
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    if (img.complete) ask(); else img.addEventListener('load', ask);
  }

  var sticky = document.querySelector('[data-sticky]');
  var cta = document.querySelector('[data-hero-cta]');
  var again = document.querySelector('.vt-again');
  if (sticky && cta && 'IntersectionObserver' in window) {
    var heroGone = false, endIn = false;
    var set = function () { sticky.hidden = !heroGone || endIn; };
    new IntersectionObserver(function (e) { heroGone = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; set(); }).observe(cta);
    if (again) new IntersectionObserver(function (e) { endIn = e[0].isIntersecting; set(); }).observe(again);
  }
})();
