// Pack pages (views/packs/pack.ejs): the Numbers Pack's live Break-Even sheet. Sales to break even = monthly costs
// divided by what each sale leaves after its own cost, rounded up.
(function () {
  var box = document.querySelector('[data-calc]');
  if (!box) return;
  var $ = function (id) { return document.getElementById(id); };
  var out = box.querySelector('[data-out]');
  function run() {
    var price = parseFloat($('an-price').value), cost = parseFloat($('an-cost').value), fixed = parseFloat($('an-fixed').value);
    var margin = price - cost;
    out.textContent = !(margin > 0) || !(fixed >= 0) ? 'never' : String(Math.ceil(fixed / margin));
  }
  box.addEventListener('input', run);
  run();
})();

// Phones: a buy bar slides up once the hero's buy button has scrolled out of view, and hides at the page's own
// second buy button so there are never two on screen.
(function () {
  var bar = document.querySelector('[data-sticky]');
  var hero = document.querySelector('[data-hero-buy]');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  var again = document.querySelector('.pk-again');
  var heroOut = false, againIn = false;
  bar.hidden = false;
  var sync = function () { bar.classList.toggle('on', heroOut && !againIn); };
  new IntersectionObserver(function (e) { heroOut = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; sync(); }).observe(hero);
  if (again) new IntersectionObserver(function (e) { againIn = e[0].isIntersecting; sync(); }).observe(again);
})();

// The files page: copy the private link.
(function () {
  var b = document.querySelector('[data-copy]');
  if (!b || !navigator.clipboard) return;
  b.addEventListener('click', function () {
    navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 2000); });
  });
})();
