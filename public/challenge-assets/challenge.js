// Day One Challenge personal pages: copy buttons, share tracking, the Day 1 scorecard,
// conditional required fields and double-submit protection. No dependencies.
(function () {
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-track]');
    if (t && window.plausible) window.plausible(t.getAttribute('data-track'), { props: { channel: t.getAttribute('data-channel') || '' } });
    var c = e.target.closest('[data-copy-text]');
    if (!c) return;
    var text = c.getAttribute('data-copy-text');
    var done = function () { var o = c.textContent; c.textContent = 'Copied'; setTimeout(function () { c.textContent = o; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (err) { /* ignore */ } ta.remove();
    }
    var open = c.getAttribute('data-open');
    if (open) setTimeout(function () { location.href = open; }, 300);
  });

  // Thank-you page: remember the email so the Idea Test gate is prefilled on Day 1,
  // and hide the challenge block on the funnel pages.
  var j = document.querySelector('[data-joined]');
  if (j) {
    if (j.getAttribute('data-email')) store('127-lead-email', j.getAttribute('data-email'));
    if (j.getAttribute('data-name')) store('127-lead-name', j.getAttribute('data-name'));
    store('127-challenge-joined', '1');
  }

  // Day 1 scorecard: live totals, the top score lights up.
  var sc = document.querySelector('[data-scorecard]');
  if (sc) {
    var calc = function () {
      var tots = [0, 0, 0];
      sc.querySelectorAll('select[data-col]').forEach(function (s) { tots[+s.getAttribute('data-col')] += +s.value || 0; });
      var max = Math.max.apply(null, tots);
      sc.querySelectorAll('[data-total]').forEach(function (td) {
        var v = tots[+td.getAttribute('data-total')];
        td.textContent = v;
        td.classList.toggle('top', v > 0 && v === max);
      });
    };
    sc.addEventListener('change', calc);
    calc();
  }

  // Check-in form: "required if" fields and one submit only.
  var f = document.querySelector('[data-checkin]');
  if (f) {
    var conds = f.querySelectorAll('[data-required-if]');
    var sync = function () {
      conds.forEach(function (wrap) {
        var p = wrap.getAttribute('data-required-if').split('=');
        var picked = f.querySelector('[name="' + p[0] + '"]:checked');
        var on = !!picked && picked.value === p[1];
        var input = wrap.querySelector('input, textarea, select');
        if (input) input.required = on;
        var opt = wrap.querySelector('.opt');
        if (opt) opt.style.display = on ? 'none' : '';
      });
      var ok = f.querySelector('[data-feature-ok]');
      if (ok) f.querySelectorAll('.ch-feature .sub input').forEach(function (i) { i.disabled = !ok.checked; if (!ok.checked) i.checked = false; });
    };
    f.addEventListener('change', sync);
    sync();
    f.addEventListener('submit', function (e) {
      if (!f.checkValidity()) { e.preventDefault(); f.reportValidity(); return; }
      var b = f.querySelector('button.btn');
      if (b) { b.disabled = true; b.firstChild.textContent = 'Saving... '; }
    });
  }
})();
