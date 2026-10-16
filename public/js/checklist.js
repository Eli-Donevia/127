// Template checklists: tick items without a page reload. Without JS the forms post normally.
(function () {
  var box = document.querySelector('.tpl-check:not(.locked)');
  if (!box || !window.fetch) return;
  var count = box.querySelector('[data-cl-count]');
  var bar = box.querySelector('[data-cl-bar]');
  box.addEventListener('submit', function (e) {
    var form = e.target.closest('.cl-item');
    if (!form) return;
    e.preventDefault();
    var btn = form.querySelector('.tick');
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(new FormData(form)).toString(),
      credentials: 'same-origin',
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        btn.classList.toggle('on', d.done);
        btn.setAttribute('aria-pressed', String(d.done));
        btn.setAttribute('aria-label', (d.done ? 'Mark not done' : 'Mark done') + btn.getAttribute('aria-label').replace(/^[^:]*/, ''));
        form.querySelector('span').classList.toggle('done-text', d.done);
        if (count) count.textContent = d.progress.done + '/' + d.progress.total;
        if (bar) bar.style.width = d.progress.pct + '%';
      })
      .catch(function () { form.submit(); })
      .then(function () { delete btn.dataset.busy; });
  });
})();
