// 127 HQ: copy the 127 link, clear the week's call with a second tap, confirm before removing
// something, and show that a slow request (Stripe, Read my week) is working.
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy-value]');
    if (!b) return;
    var v = b.getAttribute('data-copy-value');
    var html = b.innerHTML;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.innerHTML = html; }, 1400); };
    var ask = function () { window.prompt('Copy your 127 link', v); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done, ask);
    else ask();
  });

  // Radios can't be unticked, so a second tap on the chosen call clears it (keyboard users pick another).
  document.querySelectorAll('.hq-calls input').forEach(function (r) {
    r.addEventListener('pointerdown', function () { r._was = r.checked; });
    r.addEventListener('click', function () {
      if (r._was) r.checked = false;
      r._was = undefined;
    });
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    var msg = f.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) { e.preventDefault(); return; }
    var b = f.querySelector('[data-busy]');
    if (b) { b.textContent = b.getAttribute('data-busy'); b.setAttribute('aria-busy', 'true'); b.style.opacity = '.6'; }
  });
})();
