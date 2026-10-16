// Day One Challenge landing (/challenge): lead prefill, one submit per tap, the phone sticky bar.
// Reveals, scroll-lit lines and card tilt come from /js/home.js. Without JS the page still works:
// the forms post normally and the sticky bar link is a plain anchor to the hero form.
(function () {
  var root = document.querySelector('main.chl');
  if (!root) return;
  var still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function readStore(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  // The countdown partial labels itself "Time until doors open"; here it counts down to Day 1.
  var cdLabel = document.getElementById('chl-cd-k');
  if (cdLabel) [].forEach.call(root.querySelectorAll('.countdown'), function (el) { el.setAttribute('aria-labelledby', 'chl-cd-k'); });

  // Forms: prefill from an earlier lead form on this device, and stop double posts.
  var forms = [].slice.call(root.querySelectorAll('form[data-ch-form]'));
  var savedEmail = readStore('127-lead-email');
  var savedName = readStore('127-lead-name');
  forms.forEach(function (form) {
    var email = form.querySelector('input[name="email"]');
    var name = form.querySelector('input[name="first_name"]');
    if (email && !email.value && savedEmail) {
      email.value = savedEmail.slice(0, 200);
      if (name && !name.value && savedName) name.value = savedName.slice(0, 60);
    }
    form.addEventListener('submit', function (e) {
      if (form.getAttribute('data-sending')) { e.preventDefault(); return; }
      form.setAttribute('data-sending', '1');
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.setAttribute('data-html', btn.innerHTML);
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Joining...';
    });
  });
  // Coming back with the browser's back button restores the page from cache: make the buttons usable again.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    forms.forEach(function (form) {
      form.removeAttribute('data-sending');
      var btn = form.querySelector('button[type="submit"]');
      if (btn && btn.getAttribute('data-html')) {
        btn.innerHTML = btn.getAttribute('data-html');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    });
  });

  // Phone sticky bar: shows once the hero form has scrolled away, hides when the final form comes into view
  // (and stays hidden below it, so it never covers the footer). CSS hides it from 900px up.
  var bar = root.querySelector('[data-ch-sticky]');
  var hero = document.getElementById('join');
  var fin = document.getElementById('join-final');
  if (!bar || !hero) return;
  var jump = bar.querySelector('[data-ch-jump]');
  var heroGone = false, finReached = false, shown = false;
  function sync() {
    var on = heroGone && !finReached;
    if (on === shown) return;
    shown = on;
    bar.classList.toggle('on', on);
    bar.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (jump) jump.tabIndex = on ? 0 : -1;
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var above = !en.isIntersecting && en.boundingClientRect.bottom <= 0;
        if (en.target === hero) heroGone = above;
        else finReached = en.isIntersecting || above;
      });
      sync();
    });
    io.observe(hero);
    if (fin) io.observe(fin);
  }
  if (jump) jump.addEventListener('click', function (e) {
    var first = hero.querySelector('input[name="first_name"]');
    e.preventDefault();
    hero.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    // Focus inside the tap itself so phones open the keyboard.
    if (first) {
      try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
    }
  });
})();
